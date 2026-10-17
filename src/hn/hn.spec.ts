import { fetchContentWithBrowser, UnusablePageError } from '@/browser/fetchContent.js'
import { faker } from '@faker-js/faker'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { disableCache, jsonResponse, textResponse } from '../test-utils.js'
import { fetchTopStories, resolveStorySource } from './index.js'

vi.mock('@/browser/fetchContent.js', async importOriginal => ({
  ...(await importOriginal<typeof import('@/browser/fetchContent.js')>()),
  fetchContentWithBrowser: vi.fn(),
}))

const SPA_SHELL_HTML = '<!doctype html><html><body><div id="root"></div></body></html>'
const ACCESS_DENIED_HTML = `<html><body><h1>Access Denied</h1><p>${'You do not have permission to access this server. '.repeat(6)}</p></body></html>`
const BLOCKED_URL = 'https://example.com/blocked'

describe('hn', () => {
  beforeAll(() => {
    disableCache()
  })
  beforeEach(() => {
    vi.mocked(fetchContentWithBrowser).mockReset()
  })
  test('fetchTopStories', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('https://hn.algolia.com/api/v1/search?')) {
        return jsonResponse(makeHnResponseData())
      } else if (url.startsWith('https://hn.algolia.com/api/v1/items/')) {
        return jsonResponse(makeStoryDataById())
      } else {
        return textResponse(makeStoryHtml())
      }
    })

    const topStories = await fetchTopStories(1)

    expect(topStories).toHaveLength(1)
    expect(topStories[0]).toMatchObject({
      title: expect.any(String),
      storyId: expect.any(Number),
      comments: expect.any(Array),
      url: expect.any(String),
    })
  })

  test('fetchTopStories - renders with browser when fetched HTML is an SPA shell', async () => {
    const renderedHtml = makeStoryHtml()
    vi.mocked(fetchContentWithBrowser).mockResolvedValue(renderedHtml)
    global.fetch = mockHnFetch({ storyUrl: 'https://example.com/spa', storyHtml: SPA_SHELL_HTML })

    const topStories = await fetchTopStories(1)

    expect(fetchContentWithBrowser).toHaveBeenCalledWith('https://example.com/spa')
    expect(topStories[0]?.content).toContain('Comment 1')
  })

  test('fetchTopStories - uses browser directly for Puppeteer-first domains', async () => {
    vi.mocked(fetchContentWithBrowser).mockResolvedValue(makeStoryHtml())
    const storyUrl = 'https://www.nytimes.com/2026/10/13/article.html'
    global.fetch = mockHnFetch({ storyUrl, storyHtml: makeStoryHtml() })

    await fetchTopStories(1)

    expect(fetchContentWithBrowser).toHaveBeenCalledWith(storyUrl)
    expect(global.fetch).not.toHaveBeenCalledWith(storyUrl, expect.anything())
  })

  test('fetchTopStories - reads X posts from the post API, not the rendered page', async () => {
    const storyUrl = 'https://x.com/garrytan/status/1899092996702048709'
    const hnFetch = mockHnFetch({ storyUrl, storyHtml: '' })
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('https://api.fxtwitter.com/')) {
        return Promise.resolve(new Response(readXFixture('fxtwitter-quote.json')))
      }
      return hnFetch(url)
    })

    const topStories = await fetchTopStories(1)

    expect(fetchContentWithBrowser).not.toHaveBeenCalled()
    expect(topStories[0]?.content).toContain(
      'Y Combinator has helped create more than $800 billion',
    )
  })

  test('fetchTopStories - renders with browser when plain fetch is rejected', async () => {
    vi.mocked(fetchContentWithBrowser).mockResolvedValue(makeStoryHtml())
    global.fetch = mockHnFetch({
      storyUrl: BLOCKED_URL,
      storyHtml: ACCESS_DENIED_HTML,
      storyStatus: 403,
    })

    const topStories = await fetchTopStories(1)

    expect(fetchContentWithBrowser).toHaveBeenCalledWith(BLOCKED_URL)
    expect(topStories[0]?.content).toContain('Comment 1')
  })

  test('fetchTopStories - renders with browser when plain fetch throws', async () => {
    vi.mocked(fetchContentWithBrowser).mockResolvedValue(makeStoryHtml())
    const hnFetch = mockHnFetch({ storyUrl: BLOCKED_URL, storyHtml: '' })
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === BLOCKED_URL) {
        return Promise.reject(new TypeError('fetch failed'))
      }
      return hnFetch(url)
    })

    const topStories = await fetchTopStories(1)

    expect(fetchContentWithBrowser).toHaveBeenCalledWith(BLOCKED_URL)
    expect(topStories[0]?.content).toContain('Comment 1')
  })

  test('fetchTopStories - renders with browser when plain fetch gets a 200 challenge page', async () => {
    vi.mocked(fetchContentWithBrowser).mockResolvedValue(makeStoryHtml())
    global.fetch = mockHnFetch({
      storyUrl: BLOCKED_URL,
      storyHtml: readPageFixture('anubis-challenge.html'),
    })

    const topStories = await fetchTopStories(1)

    expect(fetchContentWithBrowser).toHaveBeenCalledWith(BLOCKED_URL)
    expect(topStories[0]?.content).toContain('Comment 1')
  })

  test('fetchTopStories - renders with browser when plain fetch gets an AWS WAF challenge', async () => {
    vi.mocked(fetchContentWithBrowser).mockResolvedValue(makeStoryHtml())
    global.fetch = mockHnFetch({
      storyUrl: BLOCKED_URL,
      storyHtml: makeStoryHtml(),
      storyStatus: 202,
      storyHeaders: { 'x-amzn-waf-action': 'challenge' },
    })

    await fetchTopStories(1)

    expect(fetchContentWithBrowser).toHaveBeenCalledWith(BLOCKED_URL)
  })

  test('fetchTopStories - drops a 200 challenge page when the browser also fails', async () => {
    vi.mocked(fetchContentWithBrowser).mockRejectedValue(new Error('browser crashed'))
    global.fetch = mockHnFetch({
      storyUrl: BLOCKED_URL,
      storyHtml: readPageFixture('anubis-challenge.html'),
    })

    const topStories = await fetchTopStories(1)

    expect(topStories[0]?.content).toBe('')
  })

  test('fetchTopStories - keeps story with empty content when every fetch is blocked', async () => {
    vi.mocked(fetchContentWithBrowser).mockRejectedValue(
      new UnusablePageError({ url: BLOCKED_URL, reason: 'blocked', detail: 'HTTP 403' }),
    )
    global.fetch = mockHnFetch({
      storyUrl: BLOCKED_URL,
      storyHtml: ACCESS_DENIED_HTML,
      storyStatus: 403,
    })

    const topStories = await fetchTopStories(1)

    expect(topStories).toHaveLength(1)
    expect(topStories[0]).toMatchObject({ content: '', url: BLOCKED_URL, source: 'example.com' })
  })

  test('fetchTopStories - keeps fetched HTML when browser fallback fails', async () => {
    vi.mocked(fetchContentWithBrowser).mockRejectedValue(new Error('browser crashed'))
    global.fetch = mockHnFetch({ storyUrl: 'https://example.com/spa', storyHtml: SPA_SHELL_HTML })

    const topStories = await fetchTopStories(1)

    expect(topStories).toHaveLength(1)
  })

  test('fetchTopStories - Ask HN, no url', async () => {
    const storyText = 'Hey HN, I have a question...'
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('https://hn.algolia.com/api/v1/search?')) {
        return jsonResponse({
          hits: [
            {
              title: 'Ask HN: Test',
              story_text: storyText,
              story_id: faker.number.int({ min: 10_000_000, max: 99_999_999 }),
            },
          ],
        })
      } else if (url.startsWith('https://hn.algolia.com/api/v1/items/')) {
        return jsonResponse(makeStoryDataById())
      } else {
        return textResponse(makeStoryHtml())
      }
    })

    const topStories = await fetchTopStories(1)

    expect(topStories).toHaveLength(1)
    expect(topStories?.[0]?.url).toBeUndefined()
    expect(topStories[0]).toMatchObject({
      title: expect.any(String),
      storyId: expect.any(Number),
      comments: expect.any(Array),
      content: storyText,
    })
  })
})

describe('resolveStorySource', () => {
  const url = 'https://www.example.com/post'

  test('uses the site name up to the first separator', () => {
    expect(resolveStorySource({ siteName: 'Example Blog | Home', title: 'Post', url })).toBe(
      'Example Blog',
    )
  })

  test('falls back to byline when there is no site name', () => {
    expect(resolveStorySource({ siteName: null, byline: 'Jane Doe', title: 'Post', url })).toBe(
      'Jane Doe',
    )
  })

  test('uses the readable hostname when the source equals the title or is missing', () => {
    expect(resolveStorySource({ siteName: 'Post', title: 'Post', url })).toBe('example.com')
    expect(resolveStorySource({ title: 'Post', url })).toBe('example.com')
  })
})

function mockHnFetch(params: {
  storyHeaders?: Record<string, string>
  storyHtml: string
  storyStatus?: number
  storyUrl: string
}) {
  const { storyHeaders, storyHtml, storyStatus = 200, storyUrl } = params
  return vi.fn().mockImplementation((url: string) => {
    if (url.startsWith('https://hn.algolia.com/api/v1/search?')) {
      return jsonResponse({
        hits: [{ title: 'Test Story', url: storyUrl, story_id: faker.number.int() }],
      })
    }
    if (url.startsWith('https://hn.algolia.com/api/v1/items/')) {
      return jsonResponse(makeStoryDataById())
    }
    return Promise.resolve(new Response(storyHtml, { status: storyStatus, headers: storyHeaders }))
  })
}

function readPageFixture(name: string): string {
  return readFileSync(new URL(`../browser/__fixtures__/pages/${name}`, import.meta.url), 'utf8')
}

function readXFixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/x/${name}`, import.meta.url), 'utf8')
}

function makeHnResponseData(count: number = 10) {
  return {
    hits: Array.from({ length: count }, () => ({
      title: faker.lorem.words(5),
      url: faker.internet.url(),
      story_id: faker.number.int({ min: 10_000_000, max: 99_999_999 }),
    })),
  }
}

function makeStoryDataById() {
  return {
    author: faker.person.middleName(),
    created_at: faker.date.recent().toISOString(),
    created_at_i: faker.date.recent().getTime(),
    id: faker.number.int({ min: 1, max: 100_000 }),
    children: Array.from({ length: 5 }, () => ({
      author: faker.person.middleName(),
      children: [
        {
          author: faker.person.middleName(),
          text: faker.lorem.sentence(),
          children: [],
        },
        {
          author: faker.person.middleName(),
          text: faker.lorem.sentence(),
          children: [],
        },
        {
          author: faker.person.middleName(),
          text: faker.lorem.sentence(),
          children: [],
        },
      ],
    })),
  }
}

function makeStoryHtml() {
  return `<!DOCTYPE html>
  <html>
  <head>
    <title>Test Story</title>
  </head>
  <body>
    <h1>Test Story</h1>
    <p>${faker.lorem.paragraphs(3)}</p>
    <h2>Comments</h2>
    <ul>
      <li>
        <h3>Comment 1</h3>
        <p>${faker.lorem.sentence()}</p>
        <ul>
          <li>
            <h4>Reply 1</h4>
            <p>${faker.lorem.sentence()}</p>
          </li>
          <li>
            <h4>Reply 2</h4>
            <p>${faker.lorem.sentence()}</p>
          </li>
        </ul>
      </li>
      <li>
        <h3>Comment 2</h3>
        <p>${faker.lorem.sentence()}</p>
        <ul>
          <li>
            <h4>Reply 1</h4>
            <p>${faker.lorem.sentence()}</p>
          </li>
          <li>
            <h4>Reply 2</h4>
            <p>${faker.lorem.sentence()}</p>
          </li>
        </ul>
      </li>
    </ul>
  </body>
</html>`
}
