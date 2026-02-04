import { describe, expect, test } from 'vitest'

import { getDomainHandler } from './index.js'

describe('getDomainHandler', () => {
  test.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube'],
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube'],
    ['https://youtube.com/embed/dQw4w9WgXcQ', 'youtube'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube'],
    ['https://github.com/anthropics/claude', 'github'],
    ['https://github.com/anthropics/claude/issues/123', 'github'],
    ['https://twitter.com/elonmusk/status/123456789', 'twitter'],
    ['https://x.com/elonmusk/status/123456789', 'twitter'],
    ['https://mobile.twitter.com/elonmusk/status/123456789', 'twitter'],
    ['https://example.com/article', null],
    ['https://news.ycombinator.com/item?id=123', null],
  ])('returns correct handler for %s', (url, expectedType) => {
    const handler = getDomainHandler(url)
    if (expectedType === null) {
      expect(handler).toBeNull()
    } else {
      expect(handler).not.toBeNull()
      expect(handler!.type).toBe(expectedType)
    }
  })
})
