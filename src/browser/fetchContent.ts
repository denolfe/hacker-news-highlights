/**
 * Fetch page content using Puppeteer for JS-rendered sites and bot-protected pages.
 * Falls back gracefully on timeout using domcontentloaded.
 */
import { childLogger } from '@/utils/log.js'

import { createPage, launchBrowser } from './index.js'

const logger = childLogger('BROWSER')

/**
 * Fetches rendered HTML content from a URL using Puppeteer.
 * Handles SPAs, bot protection, and heavy pages with timeout fallback.
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

    // Check for bot protection (very little content or challenge keywords)
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
      logger.warning(`Bot protection detected for ${url}`)
    }

    return await page.content()
  } finally {
    await browser.close()
  }
}
