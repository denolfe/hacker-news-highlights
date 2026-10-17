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

/**
 * Checks a page response for bot protection or an HTTP error.
 * @param params.headers - Response headers with lowercase names
 * @param params.finalUrl - URL after redirects; empty when unknown
 */
export function detectBlockedPage(params: {
  status: number
  headers: Record<string, string>
  html: string
  requestedUrl: string
  finalUrl: string
}): BlockedPage | null {
  const { status, headers, html, requestedUrl, finalUrl } = params

  if (BLOCKED_STATUSES.has(status)) {
    return { reason: 'blocked', detail: `HTTP ${status}` }
  }
  if (status >= 400) {
    return { reason: 'http-error', detail: `HTTP ${status}` }
  }
  // AWS WAF challenges use 202 and CAPTCHAs use 405
  if (headers['x-amzn-waf-action']) {
    return { reason: 'blocked', detail: `AWS WAF ${headers['x-amzn-waf-action']}` }
  }
  if (headers['cf-mitigated'] === 'challenge') {
    return { reason: 'blocked', detail: 'cf-mitigated header' }
  }
  // Sites send dead article links to the homepage with status 200 (soft 404)
  if (isRedirectToHomepage({ requestedUrl, finalUrl })) {
    return { reason: 'http-error', detail: 'redirected to homepage' }
  }

  const marker = findChallengeMarkup(html)
  return marker ? { reason: 'blocked', detail: marker } : null
}

/** Returns the vendor challenge found in the HTML, for callers that have no response status. */
export function findChallengeMarkup(html: string): null | string {
  return CHALLENGE_MARKERS.find(({ pattern }) => pattern.test(html))?.detail ?? null
}

function isRedirectToHomepage(params: { requestedUrl: string; finalUrl: string }): boolean {
  if (!params.finalUrl) {
    return false
  }
  return new URL(params.requestedUrl).pathname !== '/' && new URL(params.finalUrl).pathname === '/'
}
