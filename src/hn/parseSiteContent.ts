import { fetchContentWithBrowser } from '@/browser/fetchContent.js'
import { childLogger } from '@/utils/log.js'
import { Readability } from '@mozilla/readability'
import { JSDOM, VirtualConsole } from 'jsdom'

import { fetchPdfText } from './fetchPdfText.js'

const logger = childLogger('PARSE')

type ParseReturnType = Pick<
  NonNullable<ReturnType<Readability['parse']>>,
  'byline' | 'excerpt' | 'siteName' | 'textContent'
>

/** Minimum content length to consider extraction successful (chars) */
const MIN_CONTENT_LENGTH = 200

/** Patterns indicating SPA or bot-protected pages that need browser rendering */
const SPA_INDICATORS = [
  '<div id="app"></div>',
  '<div id="root"></div>',
  'please enable javascript',
  'enable js and disable any ad blocker',
  'checking your browser',
  'captcha-delivery.com',
]

function parseHtmlWithReadability(html: string): null | ParseReturnType {
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('error', () => {})
  const dom = new JSDOM(html, { virtualConsole })
  return new Readability(dom.window.document).parse()
}

function needsBrowserFetch(html: string, parsed: null | ParseReturnType): boolean {
  const textLength = parsed?.textContent?.length ?? 0

  // Check for SPA/bot indicators in raw HTML
  const htmlLower = html.toLowerCase()
  const hasSpaIndicator = SPA_INDICATORS.some(indicator => htmlLower.includes(indicator))

  // Consider it failed if content is too short or has SPA indicators
  return textLength < MIN_CONTENT_LENGTH || hasSpaIndicator
}

/**
 * Parse the HTML content of a site and extract the main text content, byline, excerpt, and site name.
 * Falls back to Puppeteer browser fetch for SPAs and bot-protected pages.
 */
export async function parseSiteContent(
  htmlOrUrl: string,
  options: { usePuppeteerFallback?: boolean } = {},
): Promise<ParseReturnType> {
  const { usePuppeteerFallback = true } = options
  const isUrl = htmlOrUrl.startsWith('http')

  // Handle PDF URLs
  if (isUrl && htmlOrUrl.endsWith('.pdf')) {
    const pdfText = await fetchPdfText(htmlOrUrl)
    return { siteName: '', textContent: pdfText, byline: '', excerpt: '' }
  }

  // Get HTML - either passed directly or fetch from URL
  let html = isUrl ? await fetch(htmlOrUrl).then(res => res.text()) : htmlOrUrl

  // First attempt: parse with Readability
  let parsed = parseHtmlWithReadability(html)

  // Check if we need to try Puppeteer fallback
  if (usePuppeteerFallback && isUrl && needsBrowserFetch(html, parsed)) {
    logger.info(`Content extraction insufficient, trying Puppeteer: ${htmlOrUrl}`)
    try {
      html = await fetchContentWithBrowser(htmlOrUrl)
      parsed = parseHtmlWithReadability(html)
      logger.info(`Puppeteer extraction: ${parsed?.textContent?.length ?? 0} chars`)
    } catch (err) {
      logger.warning(`Puppeteer fallback failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  return (
    parsed ?? {
      siteName: '',
      textContent: 'No content found for this story',
      byline: '',
      excerpt: '',
    }
  )
}

/**
 * Fetch and parse content using Puppeteer browser directly.
 * Use this when you know the site requires JS rendering.
 */
export async function parseSiteContentWithBrowser(url: string): Promise<ParseReturnType> {
  const html = await fetchContentWithBrowser(url)
  const parsed = parseHtmlWithReadability(html)

  return (
    parsed ?? {
      siteName: '',
      textContent: 'No content found for this story',
      byline: '',
      excerpt: '',
    }
  )
}
