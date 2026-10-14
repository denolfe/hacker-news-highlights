import { fetchContentWithBrowser } from '@/browser/fetchContent.js'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { fetchXPostHtml, parseXStatusUrl } from './fetchXPost.js'
import { parseSiteContent } from './parseSiteContent.js'

vi.mock('@/browser/fetchContent.js', () => ({ fetchContentWithBrowser: vi.fn() }))

const POST_URL = 'https://x.com/karpathy/status/2015883857489522876'

/** Mirrors X's logged-out page: parent posts, then the linked post, then replies, each in its own `article`. */
const RENDERED_THREAD_HTML = `<!doctype html><html><body><main>
  <article><a href="/karpathy/status/2015883857000000000">Jan 26</a><div dir="auto">Parent post in the thread</div></article>
  <article><a href="/karpathy">Andrej Karpathy</a><a href="/karpathy/status/2015883857489522876">2:06 PM</a><div dir="auto">A few random notes from claude coding quite a bit last few weeks. The full long-form text lives here.</div></article>
  <article><a href="/bcherny/status/2015979257038831967">Jan 26</a><div dir="auto">As always, a very thoughtful take.</div></article>
</main></body></html>`

describe('parseXStatusUrl', () => {
  test.each([
    ['https://x.com/karpathy/status/2015883857489522876', 'karpathy', '2015883857489522876'],
    ['https://twitter.com/jack/status/20', 'jack', '20'],
    ['https://www.x.com/sama/status/1932434606558462459?s=20', 'sama', '1932434606558462459'],
    [
      'https://mobile.twitter.com/lemire/status/2062880075117113739/photo/1',
      'lemire',
      '2062880075117113739',
    ],
  ])('%s', (url, username, statusId) => {
    expect(parseXStatusUrl(url)).toEqual({ username, statusId })
  })

  test.each([
    'https://x.com/karpathy',
    'https://x.com/i/broadcasts/1gqGvjeBljOGB',
    'https://example.com/karpathy/status/2015883857489522876',
  ])('rejects %s', url => {
    expect(parseXStatusUrl(url)).toBeNull()
  })
})

describe('fetchXPostHtml', () => {
  beforeEach(() => {
    vi.mocked(fetchContentWithBrowser).mockReset()
  })

  test('uses fxtwitter post and quoted post text', async () => {
    global.fetch = mockXApis({ fxtwitter: fixture('fxtwitter-quote.json') })

    const parsed = await parseSiteContent(await fetchXPostHtml(POST_URL))

    expect(parsed.textContent).toContain('Y Combinator has helped create more than $800 billion')
    expect(parsed.textContent).toContain("Y Combinator's 20th birthday is tomorrow")
    expect(parsed.textContent).toContain('Paul Graham')
    expect(fetchContentWithBrowser).not.toHaveBeenCalled()
  })

  test('uses fxtwitter article title and body blocks', async () => {
    global.fetch = mockXApis({ fxtwitter: fixture('fxtwitter-article.json') })

    const parsed = await parseSiteContent(await fetchXPostHtml(POST_URL))

    expect(parsed.textContent).toContain('An AI Agent Just Destroyed Our Production Data')
    expect(parsed.textContent).toContain("I'm Jer Crane, founder of PocketOS")
    expect(parsed.textContent).toContain('Yesterday afternoon, an AI coding agent')
  })

  test('uses syndication text for a short post when fxtwitter fails', async () => {
    global.fetch = mockXApis({
      fxtwitter: fixture('fxtwitter-private.json'),
      syndication: fixture('syndication-short.json'),
    })

    const parsed = await parseSiteContent(await fetchXPostHtml(POST_URL))

    expect(parsed.textContent).toContain('we dropped the price of o3 by 80%!!')
    expect(fetchContentWithBrowser).not.toHaveBeenCalled()
  })

  test('renders the linked post with a browser when syndication text is cut off', async () => {
    vi.mocked(fetchContentWithBrowser).mockResolvedValue(RENDERED_THREAD_HTML)
    global.fetch = mockXApis({
      fxtwitter: fixture('fxtwitter-private.json'),
      syndication: fixture('syndication-note.json'),
    })

    const parsed = await parseSiteContent(await fetchXPostHtml(POST_URL))

    expect(fetchContentWithBrowser).toHaveBeenCalledWith(POST_URL)
    expect(parsed.textContent).toContain('The full long-form text lives here.')
    expect(parsed.textContent).not.toContain('Parent post in the thread')
    expect(parsed.textContent).not.toContain('As always, a very thoughtful take.')
  })

  test('falls back to cut-off syndication text when the browser page lacks the linked post', async () => {
    vi.mocked(fetchContentWithBrowser).mockResolvedValue(
      '<html><body><div>Log in or sign up for X</div></body></html>',
    )
    global.fetch = mockXApis({
      fxtwitter: fixture('fxtwitter-private.json'),
      syndication: fixture('syndication-note.json'),
    })

    const parsed = await parseSiteContent(await fetchXPostHtml(POST_URL))

    expect(parsed.textContent).toContain('A few random notes from claude coding')
    expect(parsed.textContent).not.toContain('Log in or sign up for X')
  })

  test('returns the no-content placeholder when every source fails', async () => {
    vi.mocked(fetchContentWithBrowser).mockRejectedValue(new Error('browser crashed'))
    global.fetch = mockXApis({
      fxtwitter: fixture('fxtwitter-private.json'),
      syndication: fixture('syndication-protected.json'),
    })

    const parsed = await parseSiteContent(await fetchXPostHtml(POST_URL))

    expect(parsed.textContent).toContain('No content found for this story')
    expect(parsed.textContent).not.toContain('unable to view this Post')
  })
})

describe('parseSiteContent', () => {
  test('reads X post URLs from the post API, not the rendered page', async () => {
    vi.mocked(fetchContentWithBrowser).mockReset()
    global.fetch = mockXApis({ fxtwitter: fixture('fxtwitter-quote.json') })

    const parsed = await parseSiteContent('https://x.com/garrytan/status/1899092996702048709')

    expect(fetchContentWithBrowser).not.toHaveBeenCalled()
    expect(parsed.textContent).toContain('Y Combinator has helped create more than $800 billion')
  })
})

function fixture(name: string): Response {
  const body = readFileSync(new URL(`./__fixtures__/x/${name}`, import.meta.url), 'utf8')
  const { code } = JSON.parse(body) as { code?: number }
  return new Response(body, { status: code ?? 200 })
}

function mockXApis(responses: { fxtwitter: Response; syndication?: Response }) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.startsWith('https://api.fxtwitter.com/')) {
      return Promise.resolve(responses.fxtwitter)
    }
    if (url.startsWith('https://cdn.syndication.twimg.com/') && responses.syndication) {
      return Promise.resolve(responses.syndication)
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`))
  })
}
