import { launchBrowser } from '@/browser/index.js'
import { CACHE_DIR } from '@/constants.js'
import { cacheExists } from '@/utils/cache.js'
import { log } from '@/utils/log.js'
import path from 'path'

import { getDomainHandler } from './domain-handlers/index.js'
import { generateFallbackImage } from './fallback.js'

/** CSS to hide UI elements not covered by adblocker (consent popups, modals, ad containers) */
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
  /* CookieYes (cky-*) */
  [class^="cky-"],
  [class*=" cky-"],
  [id^="cky-"],
  /* Usercentrics (uc-*) */
  #usercentrics-root,
  [class^="uc-"],
  [class*=" uc-"],
  /* Termly */
  [class^="termly-"],
  [id^="termly-"],
  /* iubenda */
  #iubenda-cs-banner,
  [class^="iubenda-"],
  /* Klaro */
  .klaro,
  #klaro,
  /* Complianz (cmplz-*) */
  [class^="cmplz-"],
  [id^="cmplz-"],
  /* Cookie Notice */
  #cookie-notice,
  [class^="cookie-notice"],
  /* Borlabs Cookie */
  .BorlabsCookie,
  #BorlabsCookieBox,
  /* Axeptio */
  [id^="axeptio_"],
  [class^="axeptio-"],
  /* Cookie Script */
  [id^="cookiescript_"],
  [class^="cookiescript_"],
  /* Consentmanager.net */
  #cmpbox,
  [class^="cmpbox"],
  /* LiveRamp/Evidon */
  [class^="evidon-"],
  [id^="evidon-"],
  /* Generic GDPR patterns */
  [class^="gdpr-"],
  [id^="gdpr-"],
  /* Modality (latimes.com legal popup) */
  modality-custom-element,
  [id^="modality-"],
  [class*="cookie-banner"],
  [class*="cookie-consent"],
  [id*="cookie-banner"],
  [id*="cookie-consent"],

  /* Generic modal/dialog patterns - dialog and its overlay parent */
  [role="dialog"][aria-modal="true"],
  div[aria-hidden="true"]:has([role="dialog"]),

  /* NYTimes login/registration modal */
  #gateway-content,
  [data-testid="inline-message"],
  [class*="gate-"],
  [class*="Gateway"],
  [data-testid="paywall"],
  [data-testid="registration-wall"],
  /* NYTimes modal backdrop and gradient fade */
  [class*="Backdrop"],
  [class*="Overlay"]:has([role="dialog"]),
  [class*="gradient" i],
  [class*="Gradient"],
  [class*="truncate-content" i],

  /* Newsletter/subscription popups */
  [data-testid="newsletter-popup"],
  .newsletter-popup,
  .subscribe-popup,

  /* Ad container placeholders (adblocker blocks content, CSS hides empty containers) */
  [class*="ad-container"],
  [class*="ad-slot"],
  [class*="ad-wrapper"],
  [class*="ad-banner"],
  [class*="advert-"],
  [id*="google_ads"],
  [id*="div-gpt-ad"],
  .adsbygoogle,
  .dfp-leaderboard-container,
  [id^="bordeaux-"] {
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

  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    // Higher deviceScaleFactor for crisp screenshots
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 3 })

    // Try networkidle0 first, fall back to domcontentloaded on timeout
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 })
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        log.warning(`[SCREENSHOT] networkidle0 timeout, retrying with domcontentloaded`)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
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

    // Detect bot protection pages (very little content or challenge keywords)
    const isBotProtected = await page.evaluate(() => {
      const text = document.body?.innerText?.toLowerCase() || ''
      const hasLittleContent = text.length < 200
      const challengeKeywords = [
        'verifying',
        'validation required',
        'access denied',
        'please wait',
        'checking your browser',
        'just a moment',
        'enable javascript',
        'ray id',
      ]
      const hasChallenge = challengeKeywords.some(kw => text.includes(kw))
      return hasLittleContent || hasChallenge
    })

    if (isBotProtected) {
      throw new Error('Bot protection detected - page has no content or shows challenge')
    }

    // Try to inject CSS to hide popups/ads, continue without if CSP blocks it
    try {
      await page.addStyleTag({ content: HIDE_ELEMENTS_CSS })
    } catch {
      log.warning(`[SCREENSHOT] Could not inject CSS (CSP?), continuing without`)
    }

    // Collapse empty ad placeholder containers (have min-height but no content)
    // Also hide Usercentrics custom elements (uc-* tags with shadow DOM)
    // And remove gradient overlays used by paywalls
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('*')) {
        const tagName = el.tagName.toLowerCase()
        // Hide Usercentrics custom elements (uc-layer, uc-layer2, etc.)
        if (tagName.startsWith('uc-')) {
          ;(el as HTMLElement).style.display = 'none'
          continue
        }

        const style = window.getComputedStyle(el)

        // Hide overlay-positioned elements with gradient backgrounds (paywall fade overlays)
        // Only target fixed/absolute positioned elements to avoid hiding legitimate gradients
        const bg = style.backgroundImage || ''
        const position = style.position
        const isOverlay = position === 'fixed' || position === 'absolute'
        if (bg.includes('linear-gradient') && isOverlay) {
          ;(el as HTMLElement).style.display = 'none'
          continue
        }

        // Collapse empty divs with min-height (ad placeholders)
        if (tagName === 'div') {
          const minH = parseInt(style.minHeight) || 0
          const text = el.textContent?.trim() || ''
          if (minH > 100 && text.length < 50) {
            ;(el as HTMLElement).style.minHeight = '0'
            ;(el as HTMLElement).style.height = 'auto'
          }
        }
      }
    })

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
      // Check for domain-specific handler first
      const domainHandler = getDomainHandler(chapter.url)

      if (domainHandler) {
        log.info(`[SCREENSHOT] Using ${domainHandler.type} handler for: ${chapter.url}`)
        const filepath = await domainHandler.handle({
          url: chapter.url,
          storyId: chapter.storyId,
          title: chapter.title,
        })
        screenshotMap.set(chapter.storyId, filepath)
        continue
      }

      // Fall back to generic Puppeteer screenshot
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
