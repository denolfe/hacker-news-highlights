import { CACHE_DIR } from '@/constants.js'
import { cacheExists } from '@/utils/cache.js'
import { log } from '@/utils/log.js'
import path from 'path'
import puppeteer from 'puppeteer'

import { generateFallbackImage } from './fallback.js'

/** CSS to hide common banners, modals, and login prompts */
const BANNER_HIDE_CSS = `
  /* X/Twitter bottom banner */
  [data-testid="BottomBar"],
  [data-testid="sheetDialog"],
  [role="dialog"],

  /* Common cookie/consent banners */
  [class*="cookie"],
  [class*="Cookie"],
  [class*="consent"],
  [class*="Consent"],
  [id*="cookie"],
  [id*="consent"],

  /* Login/signup prompts */
  [class*="login-prompt"],
  [class*="signup-prompt"],
  [class*="LoginPrompt"],
  [class*="SignupPrompt"],

  /* Fixed bottom bars */
  [class*="bottom-bar"],
  [class*="BottomBar"],
  [class*="stickyFooter"],
  [class*="sticky-footer"],

  /* Newsletter popups */
  [class*="newsletter"],
  [class*="Newsletter"],
  [class*="popup"],
  [class*="Popup"]:not([class*="TooltipPopup"]),

  /* Generic overlay/modal */
  [class*="overlay"]:not([class*="ImageOverlay"]),
  [class*="modal"]:not(body):not(html)
  {
    display: none !important;
    visibility: hidden !important;
  }
`

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

    // Hide common banners and login prompts
    await page.addStyleTag({ content: BANNER_HIDE_CSS })

    // Brief pause to let styles apply
    await new Promise(resolve => setTimeout(resolve, 100))

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
    } catch (error) {
      log.warning(`[SCREENSHOT] Failed for ${chapter.storyId}, generating fallback`)
      log.debug('[SCREENSHOT] Error:', error)
      try {
        const filepath = await generateFallbackImage({
          title: chapter.title,
          source: new URL(chapter.url).hostname,
          storyId: chapter.storyId,
        })
        screenshotMap.set(chapter.storyId, filepath)
      } catch (fallbackError) {
        log.error(`[SCREENSHOT] Fallback also failed for ${chapter.storyId}:`, fallbackError)
      }
    }
  }
  return screenshotMap
}
