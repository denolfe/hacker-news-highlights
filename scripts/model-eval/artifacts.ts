import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

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
  /** Stories in show-notes order */
  stories: ArtifactStory[]
}

const ARTIFACT_NAME = 'output-and-cache'
const EXTRACTED_FILES = [
  'output/show-notes.txt',
  'cache/chapters.txt',
  'cache/summary-*',
  'cache/story-*',
]
/** unzip exit code when a pattern matches nothing (e.g. an episode without cached HTML) */
const UNZIP_NO_MATCH = 11

/** Downloads the newest unexpired CI artifacts (skipping ones already on disk) and loads their episodes. */
export async function downloadNewestArtifacts(params: {
  count: number
  destDir: string
}): Promise<EpisodeArtifact[]> {
  const { count, destDir } = params
  const { stdout } = await execFileAsync('gh', [
    'api',
    `repos/{owner}/{repo}/actions/artifacts?name=${ARTIFACT_NAME}&per_page=100`,
  ])
  const list: { artifacts: Array<{ created_at: string; expired: boolean; id: number }> } =
    JSON.parse(stdout)
  const newest = list.artifacts
    .filter(artifact => !artifact.expired)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, count)

  const episodes: EpisodeArtifact[] = []
  for (const artifact of newest) {
    const date = artifact.created_at.slice(0, 10)
    const dir = path.resolve(destDir, `${date}-${artifact.id}`)
    await ensureArtifactExtracted({ artifactId: artifact.id, dir })
    episodes.push({ artifactId: artifact.id, date, stories: await loadArtifactStories(dir) })
  }
  return episodes
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

const HN_ITEM_LINK = /news\.ycombinator\.com\/item\?id=(\d+)/

async function ensureArtifactExtracted(params: { artifactId: number; dir: string }): Promise<void> {
  const { artifactId, dir } = params
  if ((await readOptionalFile(path.resolve(dir, 'output/show-notes.txt'))) !== undefined) {
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
}

async function loadArtifactStories(dir: string): Promise<ArtifactStory[]> {
  const showNotes = await fs.readFile(path.resolve(dir, 'output/show-notes.txt'), 'utf-8')
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
