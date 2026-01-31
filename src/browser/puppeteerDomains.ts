/**
 * Domains that should use Puppeteer directly (skip plain fetch).
 * These are high-frequency domains from podcast history that are known
 * to be SPAs, have bot protection, or return incomplete content with fetch.
 *
 * Most domains work fine with the dynamic fallback in parseSiteContent.ts.
 * This list is for optimization only - skips the failed fetch attempt.
 */
export const PUPPETEER_PREFERRED_DOMAINS = new Set([
  // Other known problem sites from detection
  'antirez.com',
  'bloomberg.com',
  'bsky.app',
  'codepen.io',
  'crates.io',
  'economist.com',
  'finance.yahoo.com',

  'mastodon.gamedev.place',
  'mastodon.online',
  'mastodon.social',
  'mathstodon.xyz',
  'nature.com',
  'neal.fun',
  'netflixtechblog.com',

  // News sites with aggressive bot protection
  'nytimes.com',
  'reuters.com',
  'science.org',

  // Tech news with bot protection or SPAs
  'smithsonianmag.com',
  'theglobeandmail.com',
  // Social media (SPAs, require JS)
  'twitter.com',
  'washingtonpost.com',
  'wsj.com',
  'x.com',
])

/**
 * Check if a URL's domain should prefer Puppeteer for content extraction.
 */
export function shouldUsePuppeteerFirst(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    const domain = hostname.replace(/^www\./, '')

    // Check exact match
    if (PUPPETEER_PREFERRED_DOMAINS.has(domain)) {
      return true
    }

    // Check if it's a Mastodon instance (common pattern)
    if (hostname.includes('mastodon.') || hostname.includes('.social')) {
      return true
    }

    return false
  } catch {
    return false
  }
}
