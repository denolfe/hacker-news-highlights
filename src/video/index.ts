import { OUTPUT_DIR } from '@/constants.js'
import { log } from '@/utils/log.js'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { fileURLToPath } from 'node:url'
import path from 'path'

import type { ChapterInput, VideoChapter } from './types.js'

import { captureScreenshots } from './screenshots.js'

const FPS = 30
const VIDEO_OUTPUT = path.resolve(OUTPUT_DIR, 'output.mp4')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function generateVideo(params: { chapters: ChapterInput[] }): Promise<void> {
  const { chapters } = params

  log.info('[VIDEO] Starting video generation...')

  log.info('[VIDEO] Capturing screenshots...')
  const screenshotMap = await captureScreenshots({
    chapters: chapters.map(c => ({
      url: c.url,
      storyId: c.storyId,
      title: c.title,
    })),
  })

  const videoChapters: VideoChapter[] = chapters.map(chapter => ({
    title: chapter.title,
    source: chapter.source,
    screenshotPath: screenshotMap.get(chapter.storyId) ?? '',
    startFrame: Math.round(chapter.start * FPS),
    durationFrames: Math.round((chapter.end - chapter.start) * FPS),
  }))

  const totalDurationInFrames = videoChapters.reduce((sum, c) => sum + c.durationFrames, 0)

  log.info(
    `[VIDEO] Total duration: ${totalDurationInFrames} frames (${totalDurationInFrames / FPS}s)`,
  )

  log.info('[VIDEO] Bundling Remotion project...')
  const bundleLocation = await bundle({
    entryPoint: path.resolve(__dirname, 'remotion-entry.tsx'),
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

  log.info('[VIDEO] Rendering video...')
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: VIDEO_OUTPUT,
    inputProps: {
      chapters: videoChapters,
      fps: FPS,
      totalDurationInFrames,
    },
  })

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
