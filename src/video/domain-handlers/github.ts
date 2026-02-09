import { launchBrowser } from '@/browser/index.js'
import { CACHE_DIR } from '@/constants.js'
import { cacheExists } from '@/utils/cache.js'
import { log } from '@/utils/log.js'
import path from 'path'

import type { DomainHandlerParams } from './types.js'

export async function extractOgImage(url: string): Promise<null | string> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HNHighlights/1.0)',
      },
    })

    if (!response.ok) {
      return null
    }

    const html = await response.text()
    const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)

    return match ? match[1] : null
  } catch {
    return null
  }
}

export async function handleGithub(params: DomainHandlerParams): Promise<string> {
  const { url, storyId } = params
  const filename = `screenshot-${storyId}.png`
  const filepath = path.resolve(CACHE_DIR, filename)

  if (await cacheExists(filename)) {
    log.info(`[GITHUB] Using cached: ${filename}`)
    return filepath
  }

  log.info(`[GITHUB] Fetching og:image for: ${url}`)

  const ogImageUrl = await extractOgImage(url)
  if (!ogImageUrl) {
    throw new Error(`Could not extract og:image from URL: ${url}`)
  }

  log.info(`[GITHUB] Generating image with og:image: ${ogImageUrl}`)

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          width: 1920px;
          height: 1080px;
          background: #0d1117;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .og-image {
          max-width: 1800px;
          max-height: 1000px;
          object-fit: contain;
        }
      </style>
    </head>
    <body>
      <img class="og-image" src="${ogImageUrl}" alt="" />
    </body>
    </html>
  `

  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 3 })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.screenshot({ path: filepath, type: 'png' })
    log.info(`[GITHUB] Saved: ${filename}`)
    return filepath
  } finally {
    await browser.close()
  }
}
