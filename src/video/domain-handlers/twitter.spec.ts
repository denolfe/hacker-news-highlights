import { beforeEach, describe, expect, test, vi } from 'vitest'

import { fetchTweetFromOEmbed } from './twitter.js'

describe('fetchTweetFromOEmbed', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('parses tweet data from oEmbed response', async () => {
    const oembedResponse = {
      author_name: 'Naval',
      author_url: 'https://twitter.com/naval',
      html: '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">How to Get Rich</p>&mdash; Naval (@naval)</blockquote>',
    }
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(oembedResponse), { status: 200 }),
    )

    const result = await fetchTweetFromOEmbed('https://twitter.com/naval/status/123')
    expect(result).toEqual({
      displayName: 'Naval',
      username: '@naval',
      text: 'How to Get Rich',
    })
  })

  test('returns null on non-200 response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 404 }))

    const result = await fetchTweetFromOEmbed('https://twitter.com/user/status/999')
    expect(result).toBeNull()
  })

  test('returns null on fetch error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const result = await fetchTweetFromOEmbed('https://twitter.com/user/status/999')
    expect(result).toBeNull()
  })

  test('returns null when tweet text cannot be parsed', async () => {
    const oembedResponse = {
      author_name: 'User',
      author_url: 'https://twitter.com/user',
      html: '<blockquote class="twitter-tweet"></blockquote>',
    }
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(oembedResponse), { status: 200 }),
    )

    const result = await fetchTweetFromOEmbed('https://twitter.com/user/status/123')
    expect(result).toBeNull()
  })

  test('converts <br> tags to newlines', async () => {
    const oembedResponse = {
      author_name: 'User',
      author_url: 'https://twitter.com/user',
      html: '<blockquote><p>Line 1<br>Line 2<br/>Line 3</p></blockquote>',
    }
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(oembedResponse), { status: 200 }),
    )

    const result = await fetchTweetFromOEmbed('https://twitter.com/user/status/123')
    expect(result?.text).toBe('Line 1\nLine 2\nLine 3')
  })

  test('strips HTML tags like links', async () => {
    const oembedResponse = {
      author_name: 'User',
      author_url: 'https://twitter.com/user',
      html: '<blockquote><p>Check out <a href="https://example.com">this link</a>!</p></blockquote>',
    }
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(oembedResponse), { status: 200 }),
    )

    const result = await fetchTweetFromOEmbed('https://twitter.com/user/status/123')
    expect(result?.text).toBe('Check out this link!')
  })

  test('decodes HTML entities', async () => {
    const oembedResponse = {
      author_name: 'User',
      author_url: 'https://twitter.com/user',
      html: '<blockquote><p>Rock &amp; Roll &gt; Pop &lt; Jazz</p></blockquote>',
    }
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(oembedResponse), { status: 200 }),
    )

    const result = await fetchTweetFromOEmbed('https://twitter.com/user/status/123')
    expect(result?.text).toBe('Rock & Roll > Pop < Jazz')
  })
})
