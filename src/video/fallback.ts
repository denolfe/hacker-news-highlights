import { CACHE_DIR } from '@/constants.js'
import { log } from '@/utils/log.js'
import path from 'path'
import puppeteer from 'puppeteer'

export async function generateFallbackImage(params: {
  title: string
  source: string
  storyId: string
}): Promise<string> {
  const { title, source, storyId } = params
  const filename = `screenshot-${storyId}.png`
  const filepath = path.resolve(CACHE_DIR, filename)

  log.info(`[FALLBACK] Generating fallback image for: ${title}`)

  // Use Google's favicon service for reliable logo fetching
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(source)}&sz=128`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          width: 1920px;
          height: 1080px;
          background: #1a1a1a;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .logo {
          width: 128px;
          height: 128px;
          margin-bottom: 32px;
          border-radius: 16px;
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
      <img class="logo" src="${faviconUrl}" alt="" />
      <div class="title">${title}</div>
      <div class="source">${source}</div>
    </body>
    </html>
  `

  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 3 })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.screenshot({ path: filepath, type: 'png' })
    return filepath
  } finally {
    await browser.close()
  }
}
