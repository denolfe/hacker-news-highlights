/**
 * Fetch page content using Puppeteer for JS-rendered sites and bot-protected pages.
 * Falls back gracefully on timeout using domcontentloaded.
 */
import { childLogger } from '@/utils/log.js'

import { createPage, launchBrowser } from './index.js'

const logger = childLogger('BROWSER')

/** Thrown when the rendered page is a bot challenge or block page instead of real content. */
export class BotProtectionError extends Error {
  constructor(public readonly url: string) {
    super(`Bot protection detected for ${url}`)
  }
}

/** Minimum rendered text length for a page to count as real content (chars) */
const MIN_CONTENT_LENGTH = 200

/** Challenge pages are short; longer pages that mention these keywords are real articles */
const MAX_CHALLENGE_PAGE_LENGTH = 2000

const CHALLENGE_KEYWORDS = [
  'verifying',
  'validation required',
  'access denied',
  'please wait',
  'checking your browser',
  'just a moment',
  'enable javascript',
  'ray id',
]

/**
 * Fetches rendered HTML content from a URL using Puppeteer.
 * Handles SPAs and heavy pages with timeout fallback.
 * @throws {BotProtectionError} when the rendered page is a bot challenge or block page
 */
export async function fetchContentWithBrowser(url: string): Promise<string> {
  logger.info(`Fetching content: ${url}`)

  const browser = await launchBrowser()
  try {
    const page = await createPage(browser)

    // Try networkidle0 first (waits for all network requests to settle)
    // Fall back to domcontentloaded on timeout (works for heavy pages like GitHub)
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 })
    } catch (err) {
      if (err instanceof Error && err.message.includes('timeout')) {
        logger.warning(`networkidle0 timeout, retrying with domcontentloaded`)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      } else {
        throw err
      }
    }

    // Extra wait for SPAs to render content
    await new Promise(r => setTimeout(r, 2000))

    const text = await page.evaluate(() => document.body?.innerText ?? '')
    if (isBotChallengeText(text)) {
      logger.warning(`Bot protection detected for ${url}`)
      throw new BotProtectionError(url)
    }

    return await page.content()
  } finally {
    await browser.close()
  }
}

/** Detects bot challenge and block pages from rendered body text. */
export function isBotChallengeText(text: string): boolean {
  if (text.length < MIN_CONTENT_LENGTH) {
    return true
  }
  if (text.length > MAX_CHALLENGE_PAGE_LENGTH) {
    return false
  }
  const lowerText = text.toLowerCase()
  return CHALLENGE_KEYWORDS.some(keyword => lowerText.includes(keyword))
}
