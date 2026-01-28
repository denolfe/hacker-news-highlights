import { CACHE_DIR } from '@/constants.js'
import { cacheExists } from '@/utils/cache.js'
import { log } from '@/utils/log.js'
import path from 'path'
import puppeteer from 'puppeteer'

import { generateFallbackImage } from './fallback.js'

/** CSS to hide site-specific popups, ads, and UI elements */
const HIDE_ELEMENTS_CSS = `
  /* X/Twitter */
  [data-testid="BottomBar"],
  [data-testid="sidebarColumn"],
  [data-testid="sheetDialog"],

  /* Common consent platforms */
  #onetrust-consent-sdk,
  #onetrust-banner-sdk,
  .qc-cmp2-container,
  #CybotCookiebotDialog,
  .truste_overlay,
  .truste_box_overlay,
  .osano-cm-window,
  #didomi-host,
  .cc-window,
  #sp_message_container,

  /* Generic modal/dialog patterns */
  [role="dialog"][aria-modal="true"],

  /* Common ad slot patterns */
  [data-testid="ad-unit"],
  [data-ad-unit],
  [data-dfp],
  .ad-slot-header__wrapper,
  .ad-slot,
  .ad-container,
  .adsbygoogle,
  [id^="google_ads"],
  [id^="div-gpt-ad"],
  /* DFP leaderboard ads (windowscentral.com) */
  .dfp-leaderboard-container,
  [id^="bordeaux-"],

  /* Newsletter/subscription popups */
  [data-testid="newsletter-popup"],
  .newsletter-popup,
  .subscribe-popup {
    display: none !important;
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

  const args = [
    // Enhanced anti-detection for Cloudflare
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-infobars',
    '--disable-notifications',
    '--disable-popup-blocking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-translate',
    '--disable-sync',
    '--disable-background-networking',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-hang-monitor',
    '--disable-prompt-on-repost',
    '--disable-domain-reliability',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-component-extensions-with-background-pages',
    '--disable-ipc-flooding-protection',
    '--disable-back-forward-cache',
    '--disable-partial-raster',
    '--disable-skia-runtime-opts',
    '--disable-smooth-scrolling',
    '--disable-features=site-per-process,TranslateUI,BlinkGenPropertyTrees',
    '--enable-features=NetworkService,NetworkServiceInProcess',
  ]

  const browser = await puppeteer.launch({ headless: true, args })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 3 })

    // Try networkidle0 first, fall back to domcontentloaded on timeout
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 })
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        log.warning(`[SCREENSHOT] networkidle0 timeout, retrying with domcontentloaded`)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      } else {
        throw error
      }
    }

    // Wait for article to render (JS-heavy sites)
    try {
      await page.waitForSelector('article', { timeout: 5000 })
    } catch {
      // No article element, continue anyway
    }

    // Try to inject CSS to hide popups/ads, continue without if CSP blocks it
    try {
      await page.addStyleTag({ content: HIDE_ELEMENTS_CSS })
    } catch {
      log.warning(`[SCREENSHOT] Could not inject CSS (CSP?), continuing without`)
    }

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
