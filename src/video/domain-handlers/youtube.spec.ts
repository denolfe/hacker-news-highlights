import { beforeEach, describe, expect, test, vi } from 'vitest'

import { extractVideoId, getBestThumbnailUrl } from './youtube.js'

describe('extractVideoId', () => {
  test.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=abc123&t=100', 'abc123'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/abc123?t=100', 'abc123'],
    ['https://youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://example.com/video', null],
  ])('extracts video ID from %s', (url, expectedId) => {
    expect(extractVideoId(url)).toBe(expectedId)
  })
})

describe('getBestThumbnailUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('returns maxresdefault when available', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 200 }))

    const result = await getBestThumbnailUrl('dQw4w9WgXcQ')
    expect(result).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg')
  })

  test('falls back to hqdefault when maxres unavailable', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 404 }))

    const result = await getBestThumbnailUrl('dQw4w9WgXcQ')
    expect(result).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })
})
