/**
 * Integration tests for content extraction with Puppeteer fallback.
 * Tests against known problematic site categories.
 *
 * Run with: pnpm test:content
 */
import { describe, expect, it } from 'vitest'

import { parseSiteContent } from './parseSiteContent.js'

const TEST_SITES = {
  'SPA / JS-rendered': [
    { url: 'https://tonystr.net/blog/git_immitation', name: 'Vue.js SPA' },
    { url: 'https://bsky.app/profile/bsky.app/post/3lbvll2hz6c2c', name: 'Bluesky post' },
    { url: 'https://x.com/OpenAI/status/1861118984498454739', name: 'Twitter/X post' },
  ],

  'Bot protection (bypassable)': [
    {
      url: 'https://www.latimes.com/california/story/2024-01-01/la-me-california-weather',
      name: 'LA Times',
    },
    { url: 'https://openai.com/index/introducing-chatgpt-team/', name: 'OpenAI (Cloudflare)' },
  ],

  'Consent popups': [
    { url: 'https://boginjr.com/it/sw/dev/vinyl-boot/', name: 'CookieYes' },
    {
      url: 'https://newsroom.porsche.com/en/2024/company/porsche-taycan-2024-35378.html',
      name: 'Usercentrics',
    },
  ],

  'Heavy pages / Timeouts': [
    { url: 'https://blog.cloudflare.com/ddos-threat-report-for-2024-q3/', name: 'Cloudflare blog' },
    { url: 'https://github.com/anthropics/anthropic-cookbook', name: 'GitHub repo' },
  ],

  'Ad-heavy sites': [
    { url: 'https://www.androidauthority.com/google-pixel-9-3458955/', name: 'Android Authority' },
    { url: 'https://www.windowscentral.com/microsoft/windows-11', name: 'Windows Central' },
  ],

  'Static sites (baseline)': [
    {
      url: 'https://simonwillison.net/2024/Dec/19/gemini-thinking-mode/',
      name: 'Simon Willison blog',
    },
    { url: 'https://gwern.net/note/attention', name: 'Gwern' },
    {
      url: 'https://practical.engineering/blog/2024/1/20/the-hidden-engineering-of-runways',
      name: 'Practical Engineering',
    },
  ],
}

/** Sites with aggressive bot protection that can't be bypassed - tracked for reference */
const KNOWN_BLOCKED_SITES = [
  {
    url: 'https://www.nytimes.com/2024/01/01/technology/ai-chatbots.html',
    name: 'NYTimes (DataDome)',
  },
  { url: 'https://www.reuters.com/technology/', name: 'Reuters' },
  {
    url: 'https://www.sciencealert.com/the-sun-just-unleashed-its-biggest-flare-of-this-solar-cycle',
    name: 'Science Alert',
  },
]

// Export for documentation purposes
export { KNOWN_BLOCKED_SITES }

/** Social media posts have shorter content */
function getMinLength(url: string): number {
  if (url.includes('x.com') || url.includes('twitter.com') || url.includes('bsky.app')) {
    return 50
  }
  return 200
}

describe.each(Object.entries(TEST_SITES))('%s', (_, sites) => {
  it.each(sites)(
    '$name',
    async ({ url }) => {
      const result = await parseSiteContent(url)
      const textLen = result.textContent?.length ?? 0
      const minLength = getMinLength(url)

      expect(textLen).toBeGreaterThanOrEqual(minLength)
    },
    60_000,
  ) // 60s timeout per test
})
