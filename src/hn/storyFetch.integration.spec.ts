/**
 * Integration tests for the daily story fetch path against live stories from past episodes.
 * Bot protection varies by site and network, so blocked sites only assert that no block page
 * reaches the summary.
 *
 * Run with: pnpm test:content src/hn/storyFetch.integration.spec.ts
 */
import { isBotChallengeText } from '@/browser/fetchContent.js'
import { beforeAll, describe, expect, it } from 'vitest'

import { disableCache } from '../test-utils.js'
import { fetchStoryContent } from './index.js'

type StoryCase = {
  name: string
  url: string
  /** `content-or-empty`: site may block the fetch, which must yield empty content */
  expected: 'content' | 'content-or-empty'
}

const STORY_CASES: Record<string, StoryCase[]> = {
  'Bot block pages': [
    { name: 'Akamai (Tesla)', url: 'https://www.tesla.com/roadster', expected: 'content-or-empty' },
    {
      name: 'Cloudflare challenge (Substack)',
      url: 'https://mapwriting.substack.com/p/dentists',
      expected: 'content-or-empty',
    },
  ],

  'HTTP 403, browser renders': [
    {
      name: 'viceconsole.fyi',
      url: 'https://viceconsole.fyi/blog/2026/10/10/what-i-self-host/',
      expected: 'content',
    },
    {
      name: 'thereallo.dev',
      url: 'https://thereallo.dev/blog/someone-on-torrent-sites-kept-fucking-with-my-sonarr-setup',
      expected: 'content',
    },
    {
      name: 'Withings support (Zendesk)',
      url: 'https://support.withings.com/hc/en-us/community/posts/51887047154577-Unacceptable-Apple-Health-Sync-is-now-behind-a-99-year-paywall-for-new-accounts',
      expected: 'content',
    },
  ],

  'SPA shells': [
    { name: 'z.ai blog', url: 'https://z.ai/blog/glm-legal', expected: 'content' },
    {
      name: 'Intel product page',
      url: 'https://www.intel.com/content/www/us/en/products/details/discrete-gpus/data-center-gpu/d-series.html',
      expected: 'content',
    },
  ],

  'Plain fetch errors': [{ name: 'Krea', url: 'https://www.krea.ai/krea-3', expected: 'content' }],

  'X posts': [
    {
      name: 'Quote post',
      url: 'https://x.com/garrytan/status/1899092996702048709',
      expected: 'content',
    },
  ],
}

/** Readable story text is at least this long (chars) */
const MIN_CONTENT_LENGTH = 200

/** X posts are short */
const MIN_X_POST_LENGTH = 50

describe('fetchStoryContent', () => {
  beforeAll(() => {
    disableCache()
  })

  describe.each(Object.entries(STORY_CASES))('%s', (_, cases) => {
    it.each(cases)('$name', async ({ url, expected }) => {
      const story = await fetchStoryContent({ storyId: 0, title: 'Story', url })
      const content = story.content ?? ''

      if (expected === 'content-or-empty' && content === '') {
        return
      }
      expect(content.length).toBeGreaterThanOrEqual(getMinLength(url))
      // Short X posts would read as too-little-text pages
      if (content.length >= MIN_CONTENT_LENGTH) {
        expect(isBotChallengeText(content)).toBe(false)
      }
    })
  })
})

function getMinLength(url: string): number {
  return new URL(url).hostname === 'x.com' ? MIN_X_POST_LENGTH : MIN_CONTENT_LENGTH
}
