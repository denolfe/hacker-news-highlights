import { beforeEach, describe, expect, test, vi } from 'vitest'

import { extractTweetPath, parseTweetFromNitter } from './twitter.js'

describe('extractTweetPath', () => {
  test.each([
    ['https://twitter.com/elonmusk/status/123456789', 'elonmusk/status/123456789'],
    ['https://x.com/elonmusk/status/123456789', 'elonmusk/status/123456789'],
    ['https://mobile.twitter.com/user/status/999', 'user/status/999'],
    ['https://twitter.com/user/status/123?s=20', 'user/status/123'],
    ['https://example.com/page', null],
  ])('extracts tweet path from %s', (url, expectedPath) => {
    expect(extractTweetPath(url)).toBe(expectedPath)
  })
})

describe('parseTweetFromNitter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('parses tweet data from Nitter HTML', async () => {
    const html = `
      <div class="main-tweet">
        <img class="avatar" src="/pic/abc123" />
        <a class="fullname">Elon Musk</a>
        <a class="username">@elonmusk</a>
        <div class="tweet-content">Hello, world!</div>
      </div>
    `
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(html, { status: 200 }))

    const result = await parseTweetFromNitter('elonmusk/status/123')
    expect(result).toEqual({
      displayName: 'Elon Musk',
      username: '@elonmusk',
      text: 'Hello, world!',
      avatarUrl: expect.stringContaining('/pic/abc123'),
    })
  })

  test('returns null when tweet not found', async () => {
    const html = `<!DOCTYPE html><html><body>Not found</body></html>`
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(html, { status: 200 }))

    const result = await parseTweetFromNitter('user/status/999')
    expect(result).toBeNull()
  })
})
