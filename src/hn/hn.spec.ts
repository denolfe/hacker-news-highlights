import { faker } from '@faker-js/faker'
import { beforeAll, describe, expect, test, vi } from 'vitest'
import { disableCache, jsonResponse, textResponse } from '@/test-utils.js'
import { fetchTopStories } from './index.js'

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

    const topStories = await fetchTopStories(1)

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
