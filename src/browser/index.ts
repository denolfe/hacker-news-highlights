/**
 * Shared Puppeteer browser configuration with stealth and adblocker plugins.
 * Used by both screenshot capture and content fetching.
 */
import type { Browser, Page } from 'puppeteer'
import type { PuppeteerExtra } from 'puppeteer-extra'

import { createRequire } from 'module'

// puppeteer-extra has CJS/ESM interop issues - use createRequire for CJS modules
const require = createRequire(import.meta.url)
const puppeteerExtra = require('puppeteer-extra') as PuppeteerExtra
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker').default

// Enable stealth mode to bypass bot detection
puppeteerExtra.use(StealthPlugin())

// Enable adblocker - blocks ads/trackers and hides empty ad containers
puppeteerExtra.use(
  AdblockerPlugin({
    blockTrackers: true,
    blockTrackersAndAnnoyances: true,
  }),
)

/** Browser launch args for enhanced anti-detection */
const BROWSER_ARGS = [
  '--no-sandbox', // Required for CI (GitHub Actions disables unprivileged user namespaces)
  '--disable-setuid-sandbox',
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

export async function launchBrowser(): Promise<Browser> {
  return puppeteerExtra.launch({ headless: true, args: BROWSER_ARGS })
}

export async function createPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })
  return page
}

export type { Browser, Page }
export { puppeteerExtra }
