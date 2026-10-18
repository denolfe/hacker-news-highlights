/**
 * Detects bot-protection challenges, block pages, and HTTP errors from a page response.
 * Signals are statuses, vendor headers, and challenge-only markup. Vendor scripts that also
 * load on normal pages (such as Cloudflare's `/cdn-cgi/challenge-platform/scripts/jsd/`) are
 * not signals. See docs/bot-protection-detection.md for sources.
 */

export type BlockedPage = {
  /** `blocked`: bot protection; `http-error`: any other error status */
  reason: 'blocked' | 'http-error'
  detail: string
}

/** Statuses that bot protection vendors use for challenge and deny pages */
const BLOCKED_STATUSES = new Set([401, 403, 429, 503])

/** Markup that only appears on challenge pages */
const CHALLENGE_MARKERS: { detail: string; pattern: RegExp }[] = [
  { detail: 'Cloudflare challenge', pattern: /_cf_chl_opt/ },
  { detail: 'Cloudflare challenge', pattern: /\/cdn-cgi\/challenge-platform\/\S*orchestrate/ },
  { detail: 'Anubis challenge', pattern: /id="anubis_challenge"/ },
]

/** A main-frame document response from one navigation */
export type Navigation = { status: number; url: string }

/**
 * Checks a page response for bot protection or an HTTP error.
 * @param params.headers - Response headers with lowercase names
 */
export function detectBlockedPage(params: {
  status: number
  headers: Record<string, string>
  html: string
}): BlockedPage | null {
  const { status, headers, html } = params

  const statusError = classifyErrorStatus(status)
  if (statusError) {
    return statusError
  }
  // AWS WAF challenges use 202 and CAPTCHAs use 405
  if (headers['x-amzn-waf-action']) {
    return { reason: 'blocked', detail: `AWS WAF ${headers['x-amzn-waf-action']}` }
  }
  if (headers['cf-mitigated'] === 'challenge') {
    return { reason: 'blocked', detail: 'cf-mitigated header' }
  }

  const marker = findChallengeMarkup(html)
  return marker ? { reason: 'blocked', detail: marker } : null
}

/**
 * Finds an error response that the page left for another URL, such as a 404 that redirects
 * to the homepage (soft 404). An error URL that later loads successfully is a solved
 * challenge and does not count.
 * @param navigations - Main-frame document responses in load order, without redirects
 */
export function findAbandonedErrorResponse(navigations: Navigation[]): Navigation | null {
  const final = navigations.at(-1)
  if (!final) {
    return null
  }
  return (
    navigations.find(
      error =>
        error.status >= 400 &&
        !isSameUrl(error.url, final.url) &&
        !navigations.some(later => later.status < 400 && isSameUrl(later.url, error.url)),
    ) ?? null
  )
}

/** Classifies an error status; null for a success status */
export function classifyErrorStatus(status: number): BlockedPage | null {
  if (BLOCKED_STATUSES.has(status)) {
    return { reason: 'blocked', detail: `HTTP ${status}` }
  }
  if (status >= 400) {
    return { reason: 'http-error', detail: `HTTP ${status}` }
  }
  return null
}

/** Returns the vendor challenge found in the HTML, for callers that have no response status. */
export function findChallengeMarkup(html: string): null | string {
  return CHALLENGE_MARKERS.find(({ pattern }) => pattern.test(html))?.detail ?? null
}

function isSameUrl(a: string, b: string): boolean {
  return a.split('#')[0] === b.split('#')[0]
}
