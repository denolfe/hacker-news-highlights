import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { EPISODE_TITLE_SEPARATOR } from '../../src/utils/episodeDate.js'
import { childLogger } from '../../src/utils/log.js'
import { readOptionalFile } from './cache.js'

const execFileAsync = promisify(execFile)
const logger = childLogger('EVAL')

export type ShowNotesStory = {
  storyId: number
  title: string
}

export type ArtifactStory = {
  /** Published summary from the CI run */
  ciSummary?: string
  /** Real per-story audio length from the episode chapter metadata */
  durationSeconds?: number
  /** Cached raw story HTML; absent for Ask HN and failed fetches */
  htmlPath?: string
} & ShowNotesStory

export type EpisodeArtifact = {
  artifactId: number
  /** Artifact creation date, YYYY-MM-DD */
  date: string
  /** Published intro LLM sentence, template stripped */
  ciIntro?: string
  /** Published episode title LLM text, date prefix stripped */
  ciTitle?: string
  /** Stories in show-notes order */
  stories: ArtifactStory[]
}

const ARTIFACT_NAME = 'output-and-cache'
/**
 * Successful scheduled runs on main: the only runs that publish an episode. The workflow uploads
 * artifacts even on failed, manual, and branch runs. 100 runs covers the 7-day artifact retention.
 */
const PUBLISHED_RUNS_PATH =
  'repos/{owner}/{repo}/actions/workflows/generate-podcast.yml/runs?event=schedule&branch=main&status=success&per_page=100'
const SHOW_NOTES_FILE = 'output/show-notes.txt'
const EXTRACTED_FILES = [
  SHOW_NOTES_FILE,
  'cache/chapters.txt',
  'cache/summary-*',
  'cache/story-*',
  'cache/intro-*',
  'cache/title-*',
]
/** unzip exit code when a pattern matches nothing (e.g. an episode without cached HTML) */
const UNZIP_NO_MATCH = 11
const CI_INTRO_FILE = /^intro-[0-9a-f]+$/
const CI_TITLE_FILE = /^title-[0-9a-f]+$/

/** Downloads the newest published CI artifacts (skipping ones already on disk) and loads their episodes. */
export async function downloadNewestArtifacts(params: {
  count: number
  destDir: string
}): Promise<EpisodeArtifact[]> {
  const { count, destDir } = params
  const [artifactsResponse, runsResponse] = await Promise.all([
    execFileAsync('gh', [
      'api',
      `repos/{owner}/{repo}/actions/artifacts?name=${ARTIFACT_NAME}&per_page=100`,
    ]),
    // Full run objects are ~10KB each; only ids are needed
    execFileAsync('gh', ['api', PUBLISHED_RUNS_PATH, '--jq', '[.workflow_runs[].id]']),
  ])
  const list: { artifacts: ArtifactListing[] } = JSON.parse(artifactsResponse.stdout)
  const publishedRunIds: number[] = JSON.parse(runsResponse.stdout)
  const newest = selectPublishedArtifacts({
    artifacts: list.artifacts,
    count,
    publishedRunIds: new Set(publishedRunIds),
  })

  const episodes: EpisodeArtifact[] = []
  for (const artifact of newest) {
    const date = artifact.created_at.slice(0, 10)
    const dir = path.resolve(destDir, `${date}-${artifact.id}`)
    await ensureArtifactExtracted({ artifactId: artifact.id, dir })
    const intro = await readSingleCacheFile({ dir, pattern: CI_INTRO_FILE })
    const title = await readSingleCacheFile({ dir, pattern: CI_TITLE_FILE })
    episodes.push({
      artifactId: artifact.id,
      date,
      ciIntro: intro === undefined ? undefined : extractIntroSentence(intro),
      ciTitle: title === undefined ? undefined : stripTitleDatePrefix(title),
      stories: await loadArtifactStories(dir),
    })
  }
  return episodes
}

export type ArtifactListing = {
  created_at: string
  expired: boolean
  id: number
  workflow_run: { id: number }
}

/** Keeps the newest unexpired artifacts whose workflow run published an episode. */
export function selectPublishedArtifacts<T extends ArtifactListing>(params: {
  artifacts: T[]
  count: number
  publishedRunIds: Set<number>
}): T[] {
  const { artifacts, count, publishedRunIds } = params
  return artifacts
    .filter(artifact => !artifact.expired && publishedRunIds.has(artifact.workflow_run.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, count)
}

/** Reads story order from show notes: each story block starts with its title and ends with its HN link. */
export function parseShowNotes(showNotes: string): ShowNotesStory[] {
  const stories: ShowNotesStory[] = []
  for (const block of showNotes.split(/\n\s*\n/)) {
    const lines = block.trim().split('\n')
    const storyId = lines.map(line => HN_ITEM_LINK.exec(line)?.[1]).find(Boolean)
    if (storyId && lines[0]) {
      stories.push({ storyId: Number(storyId), title: lines[0].trim() })
    }
  }
  return stories
}

export type ChapterDuration = {
  title: string
  durationSeconds: number
}

/** Reads per-chapter durations from ffmpeg chapter metadata with a 1/1000 timebase. */
export function parseChapterDurations(metadata: string): ChapterDuration[] {
  return metadata
    .split('[CHAPTER]')
    .slice(1)
    .flatMap(block => {
      const start = /^START=(\d+)$/m.exec(block)?.[1]
      const end = /^END=(\d+)$/m.exec(block)?.[1]
      const title = /^title=(.*)$/m.exec(block)?.[1]
      if (start === undefined || end === undefined || title === undefined) {
        return []
      }
      return [{ title, durationSeconds: (Number(end) - Number(start)) / 1000 }]
    })
}

/** Strips the production intro template (welcome line, break tag, "Let's ..." line), leaving the LLM sentence. */
export function extractIntroSentence(intro: string): string {
  return intro
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !INTRO_TEMPLATE_LINE.test(line))
    .join(' ')
}

/** Drops the `M.D.YY` date key production prepends to the LLM episode title. */
export function stripTitleDatePrefix(title: string): string {
  const separatorIndex = title.indexOf(EPISODE_TITLE_SEPARATOR)
  if (separatorIndex === -1) {
    return title.trim()
  }
  return title.slice(separatorIndex + EPISODE_TITLE_SEPARATOR.length).trim()
}

const INTRO_TEMPLATE_LINE = /^(?:Welcome to the |<break |Let's )/
const HN_ITEM_LINK = /news\.ycombinator\.com\/item\?id=(\d+)/
/** Records which patterns a dir was extracted with, so adding a pattern re-extracts old dirs */
const EXTRACTION_MARKER = 'extracted.json'

async function ensureArtifactExtracted(params: { artifactId: number; dir: string }): Promise<void> {
  const { artifactId, dir } = params
  const markerPath = path.resolve(dir, EXTRACTION_MARKER)
  const expectedMarker = JSON.stringify(EXTRACTED_FILES)
  if ((await readOptionalFile(markerPath)) === expectedMarker) {
    logger.info(`[CACHE] Using cached: artifact ${artifactId}`)
    return
  }

  logger.info(`Downloading artifact ${artifactId}...`)
  await fs.mkdir(dir, { recursive: true })
  const zipPath = path.resolve(dir, 'artifact.zip')
  const { stdout } = await execFileAsync(
    'gh',
    ['api', `repos/{owner}/{repo}/actions/artifacts/${artifactId}/zip`],
    { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 },
  )
  await fs.writeFile(zipPath, stdout)
  try {
    await execFileAsync('unzip', ['-o', '-q', zipPath, ...EXTRACTED_FILES, '-d', dir])
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === UNZIP_NO_MATCH)) {
      throw error
    }
  }
  await fs.rm(zipPath)
  // No marker without show notes, so a rerun downloads again instead of trusting a partial dir
  if ((await readOptionalFile(path.resolve(dir, SHOW_NOTES_FILE))) === undefined) {
    throw new Error(`Artifact ${artifactId} has no ${SHOW_NOTES_FILE}`)
  }
  await fs.writeFile(markerPath, expectedMarker)
}

/** Reads the single cache file whose name matches; undefined when absent or ambiguous. */
async function readSingleCacheFile(params: {
  dir: string
  pattern: RegExp
}): Promise<string | undefined> {
  const { dir, pattern } = params
  const cacheDir = path.resolve(dir, 'cache')
  const matches = (await fs.readdir(cacheDir)).filter(name => pattern.test(name))
  if (matches.length !== 1 || !matches[0]) {
    return undefined
  }
  return await fs.readFile(path.resolve(cacheDir, matches[0]), 'utf-8')
}

async function loadArtifactStories(dir: string): Promise<ArtifactStory[]> {
  const showNotes = await fs.readFile(path.resolve(dir, SHOW_NOTES_FILE), 'utf-8')
  const chapters = parseChapterDurations(
    (await readOptionalFile(path.resolve(dir, 'cache/chapters.txt'))) ?? '',
  )

  const stories: ArtifactStory[] = []
  for (const story of parseShowNotes(showNotes)) {
    const htmlPath = path.resolve(dir, `cache/story-${story.storyId}`)
    const hasHtml = (await readOptionalFile(htmlPath)) !== undefined
    stories.push({
      ...story,
      ciSummary: await readOptionalFile(path.resolve(dir, `cache/summary-${story.storyId}`)),
      durationSeconds: chapters.find(chapter => chapter.title === story.title)?.durationSeconds,
      htmlPath: hasHtml ? htmlPath : undefined,
    })
  }
  return stories
}
