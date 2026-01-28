import { CACHE_DIR, EPISODE_OUTPUT, OUTPUT_DIR } from '@/constants.js'
import { log } from '@/utils/log.js'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'path'

import type { ChapterInput, StoryPreview, VideoChapter } from './types.js'

import { captureScreenshots } from './screenshots.js'

const FPS = 60
const VIDEO_OUTPUT = path.resolve(OUTPUT_DIR, 'output.mp4')
const VIDEO_NO_AUDIO = path.resolve(OUTPUT_DIR, 'output-no-audio.mp4')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const COVER_SOURCE = path.resolve(__dirname, '../../cover.png')
const COVER_DEST = path.resolve(CACHE_DIR, 'cover.png')

export async function generateVideo(params: { chapters: ChapterInput[] }): Promise<void> {
  const { chapters } = params

  log.info('[VIDEO] Starting video generation...')

  // Copy cover.png to cache dir so staticFile() can find it
  if (!fs.existsSync(COVER_DEST)) {
    fs.copyFileSync(COVER_SOURCE, COVER_DEST)
  }

  log.info('[VIDEO] Capturing screenshots...')
  const screenshotMap = await captureScreenshots({
    chapters: chapters.map(c => ({
      url: c.url,
      storyId: c.storyId,
      title: c.title,
    })),
  })

  // Get first 3 story chapters for intro preview
  const storyChapters = chapters.filter(c => c.url !== null)
  const storyPreviews: StoryPreview[] = storyChapters.slice(0, 3).map(chapter => {
    const screenshotPath = screenshotMap.get(chapter.storyId)
    return {
      title: chapter.title,
      source: chapter.source,
      screenshotPath: screenshotPath ? path.basename(screenshotPath) : '',
    }
  })

  const videoChapters: VideoChapter[] = chapters.map((chapter, index) => {
    const screenshotPath = screenshotMap.get(chapter.storyId)
    const isIntro = index === 0 && chapter.url === null
    const isOutro = index === chapters.length - 1 && chapter.url === null

    return {
      type: isIntro ? 'intro' : isOutro ? 'outro' : 'story',
      title: chapter.title,
      source: chapter.source,
      url: chapter.url,
      // Just the filename - will be loaded via staticFile() from publicDir
      screenshotPath: screenshotPath ? path.basename(screenshotPath) : '',
      startFrame: Math.round(chapter.start * FPS),
      durationFrames: Math.round((chapter.end - chapter.start) * FPS),
      ...(isIntro && { storyPreviews }),
    }
  })

  const totalDurationInFrames = videoChapters.reduce((sum, c) => sum + c.durationFrames, 0)

  log.info(
    `[VIDEO] Total duration: ${totalDurationInFrames} frames (${totalDurationInFrames / FPS}s)`,
  )

  log.info('[VIDEO] Bundling Remotion project...')
  const bundleLocation = await bundle({
    entryPoint: path.resolve(__dirname, 'remotion-entry.tsx'),
    publicDir: CACHE_DIR,
  })

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'PodcastVideo',
    inputProps: {
      chapters: videoChapters,
      fps: FPS,
      totalDurationInFrames,
    },
  })

  log.info('[VIDEO] Rendering video (no audio)...')
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: VIDEO_NO_AUDIO,
    inputProps: {
      chapters: videoChapters,
      fps: FPS,
      totalDurationInFrames,
    },
  })

  log.info('[VIDEO] Adding audio track...')
  execSync(
    `ffmpeg -y -i "${VIDEO_NO_AUDIO}" -i "${EPISODE_OUTPUT}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 "${VIDEO_OUTPUT}"`,
    { stdio: 'inherit' },
  )

  // Clean up temp file
  fs.unlinkSync(VIDEO_NO_AUDIO)

  log.info(`[VIDEO] Video saved to: ${VIDEO_OUTPUT}`)
}

export function generateYouTubeChapters(params: {
  chapters: Array<{ title: string; start: number }>
}): string {
  const { chapters } = params

  return chapters
    .map(chapter => {
      const minutes = Math.floor(chapter.start / 60)
      const seconds = Math.floor(chapter.start % 60)
      const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`
      return `${timestamp} ${chapter.title}`
    })
    .join('\n')
}
