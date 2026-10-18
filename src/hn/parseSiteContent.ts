import { findChallengeMarkup } from '@/browser/detectBlockedPage.js'
import { fetchContentWithBrowser } from '@/browser/fetchContent.js'
import { shouldUsePuppeteerFirst } from '@/browser/puppeteerDomains.js'
import { childLogger } from '@/utils/log.js'
import { Readability } from '@mozilla/readability'
import { JSDOM, VirtualConsole } from 'jsdom'

import { fetchPdfText } from './fetchPdfText.js'
import { fetchXPostHtml, parseXStatusUrl } from './fetchXPost.js'

const logger = childLogger('PARSE')

type ParseReturnType = Pick<
  NonNullable<ReturnType<Readability['parse']>>,
  'byline' | 'excerpt' | 'siteName' | 'textContent'
>

/** Minimum content length to consider extraction successful (chars) */
const MIN_CONTENT_LENGTH = 200

/** Patterns indicating SPA shells that need browser rendering */
const SPA_INDICATORS = ['<div id="app"></div>', '<div id="root"></div>', 'please enable javascript']

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

  let html: string
  let parsed: null | ParseReturnType

  if (isUrl && parseXStatusUrl(htmlOrUrl)) {
    html = await fetchXPostHtml(htmlOrUrl)
    parsed = parseHtmlWithReadability(html)
  } else if (isUrl && usePuppeteerFallback && shouldUsePuppeteerFirst(htmlOrUrl)) {
    // Known problem domains, skip fetch and use Puppeteer directly
    logger.info(`Known Puppeteer domain, using browser: ${htmlOrUrl}`)
    try {
      html = await fetchContentWithBrowser(htmlOrUrl)
      parsed = parseHtmlWithReadability(html)
      logger.info(`Puppeteer extraction: ${parsed?.textContent?.length ?? 0} chars`)
    } catch (err) {
      logger.warning(`Puppeteer failed, falling back to fetch: ${String(err)}`)
      html = await fetch(htmlOrUrl).then(res => res.text())
      parsed = parseHtmlWithReadability(html)
    }
  } else {
    // Standard path: try fetch first, fallback to Puppeteer if needed
    html = isUrl ? await fetch(htmlOrUrl).then(res => res.text()) : htmlOrUrl
    parsed = parseHtmlWithReadability(html)

    if (usePuppeteerFallback && isUrl && needsBrowserFetch(html, parsed)) {
      logger.info(`Content extraction insufficient, trying Puppeteer: ${htmlOrUrl}`)
      try {
        html = await fetchContentWithBrowser(htmlOrUrl)
        parsed = parseHtmlWithReadability(html)
        logger.info(`Puppeteer extraction: ${parsed?.textContent?.length ?? 0} chars`)
      } catch (err) {
        logger.warning(`Puppeteer fallback failed: ${String(err)}`)
      }
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

function parseHtmlWithReadability(html: string): null | ParseReturnType {
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('error', () => {})
  const dom = new JSDOM(html, { virtualConsole })
  return new Readability(dom.window.document).parse()
}

/** Detects SPA shells, bot-protection pages, and pages with too little extractable text. */
export function needsBrowserFetch(
  html: string,
  parsed: null | ParseReturnType = parseHtmlWithReadability(html),
): boolean {
  const textLength = parsed?.textContent?.length ?? 0

  const htmlLower = html.toLowerCase()
  const hasSpaIndicator = SPA_INDICATORS.some(indicator => htmlLower.includes(indicator))

  return textLength < MIN_CONTENT_LENGTH || hasSpaIndicator || findChallengeMarkup(html) !== null
}
