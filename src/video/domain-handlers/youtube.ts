import { launchBrowser } from '@/browser/index.js'
import { CACHE_DIR } from '@/constants.js'
import { cacheExists } from '@/utils/cache.js'
import { log } from '@/utils/log.js'
import path from 'path'

import type { DomainHandlerParams } from './types.js'

import { DEVICE_SCALE_FACTOR, VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from '../constants.js'

export function extractVideoId(url: string): null | string {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

export async function getBestThumbnailUrl(videoId: string): Promise<string> {
  const maxresUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`

  try {
    const response = await fetch(maxresUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })

    if (response.ok) {
      return maxresUrl
    }
  } catch {
    // Network error, fall through to fallback
  }

  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

export async function handleYoutube(params: DomainHandlerParams): Promise<string> {
  const { url, storyId } = params
  const filename = `screenshot-${storyId}.png`
  const filepath = path.resolve(CACHE_DIR, filename)

  if (await cacheExists(filename)) {
    log.info(`[YOUTUBE] Using cached: ${filename}`)
    return filepath
  }

  const videoId = extractVideoId(url)
  if (!videoId) {
    throw new Error(`Could not extract video ID from URL: ${url}`)
  }

  log.info(`[YOUTUBE] Generating image for video: ${videoId}`)

  const thumbnailUrl = await getBestThumbnailUrl(videoId)

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          width: ${VIEWPORT_WIDTH}px;
          height: ${VIEWPORT_HEIGHT}px;
          background: #0f0f0f;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .thumbnail {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
      </style>
    </head>
    <body>
      <img class="thumbnail" src="${thumbnailUrl}" alt="" />
    </body>
    </html>
  `

  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setViewport({
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.screenshot({ path: filepath, type: 'png' })
    log.info(`[YOUTUBE] Saved: ${filename}`)
    return filepath
  } finally {
    await browser.close()
  }
}
