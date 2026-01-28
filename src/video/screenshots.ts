import { CACHE_DIR } from '@/constants.js'
import { cacheExists } from '@/utils/cache.js'
import { log } from '@/utils/log.js'
import path from 'path'
import puppeteer from 'puppeteer'

import { generateFallbackImage } from './fallback.js'

export async function captureScreenshot(params: { url: string; storyId: string }): Promise<string> {
  const { url, storyId } = params
  const filename = `screenshot-${storyId}.png`
  const filepath = path.resolve(CACHE_DIR, filename)

  if (await cacheExists(filename)) {
    log.info(`[SCREENSHOT] Using cached: ${filename}`)
    return filepath
  }

  log.info(`[SCREENSHOT] Capturing: ${url}`)

  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 })
    await page.screenshot({ path: filepath, type: 'png' })
    log.info(`[SCREENSHOT] Saved: ${filename}`)
    return filepath
  } catch (error) {
    log.error(`[SCREENSHOT] Failed for ${url}:`, error)
    throw error
  } finally {
    await browser.close()
  }
}

export async function captureScreenshots(params: {
  chapters: Array<{ url: null | string; storyId: string; title: string }>
}): Promise<Map<string, string>> {
  const { chapters } = params
  const screenshotMap = new Map<string, string>()

  for (const chapter of chapters) {
    if (!chapter.url) {
      continue
    }
    try {
      const filepath = await captureScreenshot({ url: chapter.url, storyId: chapter.storyId })
      screenshotMap.set(chapter.storyId, filepath)
    } catch {
      log.warning(`[SCREENSHOT] Failed for ${chapter.storyId}, generating fallback`)
      try {
        const filepath = await generateFallbackImage({
          title: chapter.title,
          source: new URL(chapter.url).hostname,
          storyId: chapter.storyId,
        })
        screenshotMap.set(chapter.storyId, filepath)
      } catch {
        log.error(`[SCREENSHOT] Fallback also failed for ${chapter.storyId}`)
      }
    }
  }
  return screenshotMap
}
