import { faker } from '@faker-js/faker'
import { beforeAll, describe, expect, test, vi } from 'vitest'
import * as cache from '@/utils/cache.js'
import { disableCache, jsonResponse, textResponse } from '../test-utils.js'
import { enrichStory, fetchTopStories, selectStories } from './index.js'

describe('hn', () => {
  beforeAll(() => {
    disableCache()
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

    const { stories: topStories } = await fetchTopStories(1)

    expect(topStories).toHaveLength(1)
    expect(topStories[0]).toMatchObject({
      title: expect.any(String),
      storyId: expect.any(Number),
      comments: expect.any(Array),
      url: expect.any(String),
    })
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

    const { stories: topStories } = await fetchTopStories(1)

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

describe('selectStories', () => {
  beforeAll(() => {
    disableCache()
  })

  const makeHit = (overrides: Record<string, unknown> = {}) => ({
    title: faker.lorem.words(5),
    url: faker.internet.url(),
    story_id: faker.number.int({ min: 10_000_000, max: 99_999_999 }),
    points: faker.number.int({ min: 1, max: 500 }),
    ...overrides,
  })

  test('filters out who-is-hiring posts', async () => {
    const hits = [makeHit({ title: 'Ask HN: Who is Hiring? (July 2026)' }), makeHit(), makeHit()]
    global.fetch = vi.fn().mockResolvedValue(await jsonResponse({ hits }))

    const { stories } = await selectStories(2)

    expect(stories).toHaveLength(2)
    expect(stories.some(s => /who is hiring/i.test(s.title))).toBe(false)
  })

  test('filters out recently covered stories', async () => {
    const covered = makeHit()
    const hits = [covered, makeHit(), makeHit()]
    global.fetch = vi.fn().mockResolvedValue(await jsonResponse({ hits }))
    vi.spyOn(cache, 'readFromCache').mockResolvedValue(
      JSON.stringify([{ id: covered.story_id, coveredAt: new Date().toISOString() }]),
    )

    const { stories } = await selectStories(2)

    expect(stories.some(s => s.storyId === covered.story_id)).toBe(false)
  })

  test('slices to count after over-fetching', async () => {
    const hits = Array.from({ length: 13 }, () => makeHit())
    global.fetch = vi.fn().mockResolvedValue(await jsonResponse({ hits }))
    vi.spyOn(cache, 'readFromCache').mockResolvedValue(null)

    const { stories } = await selectStories(3)

    expect(stories).toHaveLength(3)
  })

  test('throws when fewer than count remain', async () => {
    const hits = [makeHit()]
    global.fetch = vi.fn().mockResolvedValue(await jsonResponse({ hits }))
    vi.spyOn(cache, 'readFromCache').mockResolvedValue(null)

    await expect(selectStories(5)).rejects.toThrow(/Not enough stories/)
  })

  test('newCovered combines prior covered and newly selected', async () => {
    const prior = { id: 111, coveredAt: new Date().toISOString() }
    const hits = [makeHit({ story_id: 222 }), makeHit({ story_id: 333 })]
    global.fetch = vi.fn().mockResolvedValue(await jsonResponse({ hits }))
    vi.spyOn(cache, 'readFromCache').mockResolvedValue(JSON.stringify([prior]))

    const { newCovered } = await selectStories(2)

    const ids = newCovered.map(c => c.id)
    expect(ids).toContain(111)
    expect(ids).toContain(222)
    expect(ids).toContain(333)
  })
})

describe('enrichStory', () => {
  beforeAll(() => {
    disableCache()
  })

  const itemsResponse = () =>
    jsonResponse({
      children: [
        {
          id: 1,
          created_at: new Date().toISOString(),
          text: faker.lorem.sentence(),
          author: faker.person.firstName(),
          children: [],
        },
      ],
    })

  test('Ask HN story uses story_text and Hacker News source', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('https://hn.algolia.com/api/v1/items/')) return itemsResponse()
      return textResponse('should not be fetched')
    })

    const result = await enrichStory({
      title: 'Ask HN: Test',
      storyId: 123,
      story_text: 'Hey HN, a question...',
      points: 10,
    })

    expect(result).toMatchObject({
      content: 'Hey HN, a question...',
      source: 'Hacker News',
      storyId: 123,
      comments: expect.any(Array),
    })
    expect(result?.url).toBeUndefined()
  })

  test('link post fetches content and applies source heuristic', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('https://hn.algolia.com/api/v1/items/')) return itemsResponse()
      return textResponse(`<!DOCTYPE html><html><head><title>Test Story</title></head>
        <body><h1>Test Story</h1><p>${faker.lorem.paragraphs(3)}</p></body></html>`)
    })

    const result = await enrichStory({
      title: 'A linked article',
      storyId: 456,
      url: 'https://example.com/post',
      points: 42,
    })

    expect(result).toMatchObject({
      storyId: 456,
      url: 'https://example.com/post',
      comments: expect.any(Array),
    })
    expect(result?.content).toEqual(expect.any(String))
    expect(result?.source).toEqual(expect.any(String))
  })

  test('returns null when there is no url and no story_text', async () => {
    global.fetch = vi.fn().mockImplementation(async () => itemsResponse())

    const result = await enrichStory({ title: 'No content', storyId: 789, points: 1 })

    expect(result).toBeNull()
  })

  test('returns null when content is empty', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('https://hn.algolia.com/api/v1/items/')) return itemsResponse()
      return textResponse('')
    })

    const result = await enrichStory({
      title: 'Empty page',
      storyId: 999,
      url: 'https://example.com/empty',
      points: 5,
    })

    expect(result).toBeNull()
  })
})
