/**
 * Compares story summaries from the newest CI episodes: published CI text, a gpt-4.1-nano
 * rerun (noise baseline), and gpt-5.6-luna at two settings, all on the same rebuilt input.
 * Writes output/model-eval/report.md. Every API result is cached, so reruns are free.
 *
 * Usage: pnpm eval:models
 */
import type { OpenAIProvider } from '@ai-sdk/openai'

import { createOpenAI } from '@ai-sdk/openai'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { StoryOutput } from '../../src/types.js'
import type { ArtifactStory } from './artifacts.js'
import type { Generation, GenerationColumn } from './generate.js'
import type { EvaluatedStory, ReportColumn, SkippedStory } from './report.js'

import { buildStorySummaryPrompt } from '../../src/ai/index.js'
import { fetchStoryDataById, resolveStorySource } from '../../src/hn/index.js'
import { parseSiteContent } from '../../src/hn/parseSiteContent.js'
import { loadEnvIfExists } from '../../src/utils/env.js'
import { childLogger } from '../../src/utils/log.js'
import { downloadNewestArtifacts } from './artifacts.js'
import { EVAL_DIR, getOrComputeJson } from './cache.js'
import { generateCached, LUNA_COLUMNS, NANO_COLUMN, priceUsage, sumUsage } from './generate.js'
import { deriveWpm } from './metrics.js'
import { renderReport } from './report.js'

type StoryInput = Pick<StoryOutput, 'comments' | 'content' | 'source' | 'title'>

type RebuiltStory = { input: StoryInput } | { skipReason: string }

type PendingStory = {
  ciSummary: string
  date: string
  input: StoryInput
  rank: number
  storyId: number
  title: string
}

const EPISODE_COUNT = 7
const GENERATION_CONCURRENCY = 6
const REPORT_PATH = path.resolve(EVAL_DIR, 'report.md')
const CI_COLUMN: ReportColumn = { id: 'ci', label: 'CI (published)' }

const logger = childLogger('EVAL')

loadEnvIfExists()

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing required env OPENAI_API_KEY')
  }
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const episodes = await downloadNewestArtifacts({
    count: EPISODE_COUNT,
    destDir: path.resolve(EVAL_DIR, 'artifacts'),
  })
  const allStories = episodes.flatMap(episode =>
    episode.stories.map((story, i) => ({ date: episode.date, rank: i + 1, story })),
  )
  const wpm = deriveWpm(
    allStories.flatMap(({ story }) =>
      story.ciSummary && story.durationSeconds
        ? [{ text: story.ciSummary, durationSeconds: story.durationSeconds }]
        : [],
    ),
  )

  const skipped: SkippedStory[] = []
  const pending: PendingStory[] = []
  for (const { date, rank, story } of allStories) {
    const skip = (reason: string) =>
      skipped.push({ date, storyId: story.storyId, title: story.title, reason })
    if (!story.ciSummary) {
      skip('no CI summary in artifact')
      continue
    }
    const rebuilt = await rebuildStoryCached(story)
    if ('skipReason' in rebuilt) {
      skip(rebuilt.skipReason)
      continue
    }
    pending.push({ ...story, ciSummary: story.ciSummary, date, rank, input: rebuilt.input })
  }

  const generationColumns = [NANO_COLUMN, ...LUNA_COLUMNS]
  const generations = await generateAll({ columns: generationColumns, openai, stories: pending })

  const evaluated: EvaluatedStory[] = []
  const usedGenerations = new Map<string, Generation[]>(generationColumns.map(c => [c.id, []]))
  for (const story of pending) {
    const found = generationColumns.map(column => ({
      column,
      generation: generations.get(generationKey(column, story.storyId)),
    }))
    const missing = found.filter(({ generation }) => !generation).map(({ column }) => column.label)
    if (missing.length > 0) {
      skipped.push({ ...story, reason: `generation failed: ${missing.join(', ')}` })
      continue
    }
    const texts: Record<string, string> = { [CI_COLUMN.id]: story.ciSummary }
    for (const { column, generation } of found) {
      if (generation) {
        texts[column.id] = generation.text
        usedGenerations.get(column.id)?.push(generation)
      }
    }
    evaluated.push({
      date: story.date,
      rank: story.rank,
      storyId: story.storyId,
      title: story.title,
      texts,
    })
  }
  if (evaluated.length === 0) {
    throw new Error('No story has output from every column; see errors above')
  }

  const toReportColumn = (column: GenerationColumn): ReportColumn => {
    const usage = sumUsage((usedGenerations.get(column.id) ?? []).map(g => g.usage))
    return { ...column, usage, costUsd: priceUsage({ pricing: column.pricing, usage }) }
  }
  const report = renderReport({
    baseline: toReportColumn(NANO_COLUMN),
    candidates: LUNA_COLUMNS.map(toReportColumn),
    ci: CI_COLUMN,
    skipped,
    stories: evaluated,
    wpm,
  })
  await fs.writeFile(REPORT_PATH, report)
  logger.info(`Evaluated ${evaluated.length} stories, skipped ${skipped.length}`)
  logger.info(`Report: ${REPORT_PATH}`)
}

/** Caches the rebuilt input so every column and every rerun sees the same comments. */
async function rebuildStoryCached(story: ArtifactStory): Promise<RebuiltStory> {
  try {
    return await getOrComputeJson(`inputs/story-${story.storyId}.json`, () => rebuildStory(story))
  } catch (error) {
    logger.error(`Failed to rebuild story ${story.storyId}:`, error)
    return {
      skipReason: `input rebuild failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Rebuilds the summary input the way production does: metadata and comments from Algolia,
 * content from the cached HTML through the Readability parser, or Algolia text for Ask HN.
 */
async function rebuildStory(story: ArtifactStory): Promise<RebuiltStory> {
  const data = await fetchStoryDataById(story.storyId)
  const base = { comments: data.comments, title: data.title }

  if (!data.url && data.content) {
    return { input: { ...base, content: data.content, source: 'Hacker News' } }
  }
  if (!data.url || !story.htmlPath) {
    return { skipReason: 'no cached HTML and no Algolia text' }
  }

  const html = await fs.readFile(story.htmlPath, 'utf-8')
  const { byline, excerpt, siteName, textContent } = await parseSiteContent(html, {
    usePuppeteerFallback: false,
  })
  return {
    input: {
      ...base,
      content: textContent || excerpt || '',
      source: resolveStorySource({ byline, siteName, title: data.title, url: data.url }),
    },
  }
}

async function generateAll(params: {
  columns: GenerationColumn[]
  openai: OpenAIProvider
  stories: PendingStory[]
}): Promise<Map<string, Generation>> {
  const { columns, openai, stories } = params
  const generations = new Map<string, Generation>()
  const tasks = stories.flatMap(story =>
    columns.map(column => async () => {
      try {
        const generation = await generateCached({
          cacheKey: `summary-${story.storyId}`,
          column,
          openai,
          prompt: buildStorySummaryPrompt(story.input),
        })
        generations.set(generationKey(column, story.storyId), generation)
      } catch (error) {
        logger.error(`${column.label} failed for story ${story.storyId}:`, error)
      }
    }),
  )
  await runWithConcurrency({ limit: GENERATION_CONCURRENCY, tasks })
  return generations
}

function generationKey(column: GenerationColumn, storyId: number): string {
  return `${column.id}/${storyId}`
}

async function runWithConcurrency(params: {
  limit: number
  tasks: Array<() => Promise<void>>
}): Promise<void> {
  const { limit, tasks } = params
  let next = 0
  const worker = async () => {
    while (next < tasks.length) {
      const task = tasks[next++]
      await task?.()
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
}

main().catch(error => {
  logger.error(error)
  process.exit(1)
})
