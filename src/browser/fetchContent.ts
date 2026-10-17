/**
 * Fetch page content using Puppeteer for JS-rendered sites and bot-protected pages.
 * Falls back gracefully on timeout using domcontentloaded.
 */
import type { HTTPResponse } from 'puppeteer'

import { childLogger } from '@/utils/log.js'

import type { BlockedPage } from './detectBlockedPage.js'

import { detectBlockedPage } from './detectBlockedPage.js'
import { createPage, launchBrowser } from './index.js'

const logger = childLogger('BROWSER')

/** Thrown when the rendered page is a block page, an HTTP error, or has too little text. */
export class UnusablePageError extends Error {
  public readonly detail: string
  public readonly reason: 'insufficient-content' | BlockedPage['reason']
  public readonly url: string

  constructor(params: {
    url: string
    reason: 'insufficient-content' | BlockedPage['reason']
    detail: string
  }) {
    super(`Unusable page (${params.reason}: ${params.detail}) for ${params.url}`)
    this.url = params.url
    this.reason = params.reason
    this.detail = params.detail
  }
}

/** Minimum rendered text length for a page to count as real content (chars) */
const MIN_CONTENT_LENGTH = 200

/**
 * Fetches rendered HTML content from a URL using Puppeteer.
 * Handles SPAs and heavy pages with timeout fallback.
 * @throws {UnusablePageError} when the final page is blocked, an HTTP error, or nearly empty
 */
export async function fetchContentWithBrowser(url: string): Promise<string> {
  logger.info(`Fetching content: ${url}`)

  const browser = await launchBrowser()
  try {
    const page = await createPage(browser)

    // A challenge that solves itself navigates again, so `goto()` returns the challenge response
    let finalResponse: HTTPResponse | null = null
    page.on('response', response => {
      const isMainDocument =
        response.request().isNavigationRequest() && response.frame() === page.mainFrame()
      const isRedirect = response.status() >= 300 && response.status() < 400
      if (isMainDocument && !isRedirect) {
        finalResponse = response
      }
    })

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

    const html = await page.content()
    const status = getStatus(finalResponse)
    logger.info(`Rendered ${url}: HTTP ${status}`)

    const blocked = detectBlockedPage({
      status,
      headers: getHeaders(finalResponse),
      html,
      requestedUrl: url,
      finalUrl: page.url(),
    })
    if (blocked) {
      logger.warning(`Unusable page (${blocked.reason}: ${blocked.detail}) for ${url}`)
      throw new UnusablePageError({ url, ...blocked })
    }

    const text = await page.evaluate(() => document.body?.innerText ?? '')
    if (text.length < MIN_CONTENT_LENGTH) {
      const detail = `${text.length} chars of text`
      logger.warning(`Unusable page (insufficient-content: ${detail}) for ${url}`)
      throw new UnusablePageError({ url, reason: 'insufficient-content', detail })
    }

    return html
  } finally {
    await browser.close()
  }
}

/** Status of the final main-frame response, or 0 when the page loaded without one */
function getStatus(response: HTTPResponse | null): number {
  return response?.status() ?? 0
}

function getHeaders(response: HTTPResponse | null): Record<string, string> {
  return response?.headers() ?? {}
}
