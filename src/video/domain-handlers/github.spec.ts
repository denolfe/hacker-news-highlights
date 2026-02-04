import { beforeEach, describe, expect, test, vi } from 'vitest'

import { extractOgImage } from './github.js'

describe('extractOgImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('extracts og:image from HTML', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta property="og:image" content="https://opengraph.githubassets.com/abc123/owner/repo" />
      </head>
      <body></body>
      </html>
    `
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(html, { status: 200 }))

    const result = await extractOgImage('https://github.com/owner/repo')
    expect(result).toBe('https://opengraph.githubassets.com/abc123/owner/repo')
  })

  test('returns null when og:image not found', async () => {
    const html = `<!DOCTYPE html><html><head></head><body></body></html>`
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(html, { status: 200 }))

    const result = await extractOgImage('https://github.com/owner/repo')
    expect(result).toBeNull()
  })

  test('returns null on fetch error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const result = await extractOgImage('https://github.com/owner/repo')
    expect(result).toBeNull()
  })

  test('returns null on non-200 response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 404 }))

    const result = await extractOgImage('https://github.com/owner/repo')
    expect(result).toBeNull()
  })
})
