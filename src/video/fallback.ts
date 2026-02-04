import { launchBrowser } from '@/browser/index.js'
import { CACHE_DIR } from '@/constants.js'
import { log } from '@/utils/log.js'
import path from 'path'

import { DEVICE_SCALE_FACTOR, VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from './constants.js'

export async function generateFallbackImage(params: {
  title: string
  source: string
  storyId: string
}): Promise<string> {
  const { title, source, storyId } = params
  const filename = `screenshot-${storyId}.png`
  const filepath = path.resolve(CACHE_DIR, filename)

  log.info(`[FALLBACK] Generating fallback image for: ${title}`)

  const logoUrl = await getBestLogoUrl(source)

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          width: ${VIEWPORT_WIDTH}px;
          height: ${VIEWPORT_HEIGHT}px;
          background: #1a1a1a;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .logo {
          width: 180px;
          height: 180px;
          margin-bottom: 40px;
          border-radius: 24px;
          object-fit: contain;
        }
        .title {
          color: white;
          font-size: 48px;
          font-weight: bold;
          text-align: center;
          max-width: 1600px;
          line-height: 1.3;
        }
        .source {
          color: #888;
          font-size: 32px;
          margin-top: 24px;
        }
      </style>
    </head>
    <body>
      <img class="logo" src="${logoUrl}" alt="" />
      <div class="title">${title}</div>
      <div class="source">${source}</div>
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
    return filepath
  } finally {
    await browser.close()
  }
}

/**
 * Tries multiple logo sources in order of preference:
 * 1. icon.horse - aggregates best available icon
 * 2. apple-touch-icon - high-res icon from site root
 * 3. Google favicon - reliable fallback at 128px
 */
async function getBestLogoUrl(domain: string): Promise<string> {
  const iconHorseUrl = `https://icon.horse/icon/${encodeURIComponent(domain)}`
  const iconHorse = await tryFetchLogo(iconHorseUrl)
  if (iconHorse) {
    log.info(`[FALLBACK] Using icon.horse for ${domain}`)
    return iconHorse
  }

  const appleTouchUrl = `https://${domain}/apple-touch-icon.png`
  const appleTouch = await tryFetchLogo(appleTouchUrl)
  if (appleTouch) {
    log.info(`[FALLBACK] Using apple-touch-icon for ${domain}`)
    return appleTouch
  }

  log.info(`[FALLBACK] Using Google favicon for ${domain}`)
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
}

/** Returns the URL if it responds with an image content-type, null otherwise */
async function tryFetchLogo(url: string): Promise<null | string> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })
    const contentType = response.headers.get('content-type') || ''
    if (response.ok && contentType.startsWith('image/')) {
      return url
    }
  } catch {
    // Network error
  }
  return null
}
