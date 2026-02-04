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

const GITHUB_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <path fill="#fff" d="M24 4C12.95 4 4 12.95 4 24c0 8.84 5.73 16.33 13.67 18.98.99.18 1.36-.43 1.36-.96 0-.47-.02-1.72-.03-3.38-5.56 1.21-6.73-2.68-6.73-2.68-.91-2.31-2.22-2.92-2.22-2.92-1.81-1.24.14-1.21.14-1.21 2 .14 3.06 2.06 3.06 2.06 1.78 3.05 4.67 2.17 5.81 1.66.18-1.29.7-2.17 1.27-2.67-4.44-.5-9.11-2.22-9.11-9.87 0-2.18.78-3.96 2.05-5.36-.2-.5-.89-2.53.2-5.28 0 0 1.67-.54 5.48 2.05 1.59-.44 3.3-.66 5-.67 1.7.01 3.41.23 5 .67 3.8-2.59 5.47-2.05 5.47-2.05 1.09 2.75.4 4.78.2 5.28 1.28 1.4 2.05 3.18 2.05 5.36 0 7.67-4.68 9.36-9.14 9.85.72.62 1.36 1.84 1.36 3.71 0 2.68-.02 4.84-.02 5.5 0 .53.36 1.15 1.38.96C38.28 40.32 44 32.84 44 24 44 12.95 35.05 4 24 4z"/>
</svg>
`

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
          position: relative;
        }
        .og-image {
          max-width: 1800px;
          max-height: 1000px;
          object-fit: contain;
        }
        .logo {
          position: absolute;
          bottom: 40px;
          left: 40px;
        }
      </style>
    </head>
    <body>
      <img class="og-image" src="${ogImageUrl}" alt="" />
      <div class="logo">${GITHUB_LOGO_SVG}</div>
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
