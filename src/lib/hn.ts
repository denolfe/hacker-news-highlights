import type { Comment, ResponseData, SlimComment, StoryOutput } from '../types'

import { readFromCache, writeToCache } from '../utils/cache'
import { childLogger } from '../utils/log'
import { parseSiteContent } from '../utils/parseSiteContent'

const logger = childLogger('HN')

export async function fetchTopStories(count: number = 10): Promise<StoryOutput[]> {
  logger.info(`Fetching top ${count} stories...`)

  // Fetch additional stories to account for stories covered in previous episodes
  const response = await fetch(
    `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${count + 10}`,
  )
  const data = (await response.json()) as ResponseData

  // Extract only the data we need
  const slim = data.hits.map(s => {
    return {
      title: s.title,
      url: s.url,
      storyId: s.story_id,
      story_text: s.story_text,
      points: s.points,
    }
  })

  // Check if we have already covered the story
  const covered = await readFromCache('covered-stories')
  const coveredStories: number[] = covered ? JSON.parse(covered) : []

  logger.info(`Found ${coveredStories.length} covered stories`, {
    coveredStories,
  })

  // Filter out stories we have already covered
  const filtered = slim
    .filter(s => {
      const wasCovered = coveredStories.includes(s.storyId)
      if (wasCovered) {
        logger.info({ storyId: s.storyId, wasCovered })
      }
      return !wasCovered
    })
    // filter out `Who is hiring` posts
    .filter(s => {
      const pattern = /who is hiring/i
      return !pattern.test(s.title)
    })
    .slice(0, count)

  logger.debug({ filtered })

  if (filtered.length < count) {
    const msg = `Not enough stories to cover. Found ${filtered.length}, expected ${count}`
    logger.error(msg)
    throw new Error(msg)
  }

  const newCovered = [...coveredStories, ...filtered.map(s => s.storyId)]
  logger.debug({ newCovered })

  // Save the covered stories, but only in CI to prevent dupes between daily runs
  if (process.env.CI) {
    await writeToCache('covered-stories', JSON.stringify(newCovered))
  }

  // Fetch the content and comments for each story
  const output: StoryOutput[] = []
  for (const [i, story] of filtered.entries()) {
    const comments = await fetchHnCommentsById(story.storyId)
    logger.info(`[${i + 1}/${filtered.length}] ${story.storyId} - ${story.title} - ${story.url}`)
    const cacheKey = 'story-' + story.storyId.toString()

    let htmlString = await readFromCache(cacheKey)

    const baseStoryOutput: Pick<
      StoryOutput,
      'comments' | 'hnUrl' | 'points' | 'storyId' | 'title'
    > = {
      title: story.title,
      storyId: story.storyId,
      comments,
      hnUrl: `https://news.ycombinator.com/item?id=${story.storyId}`,
      points: story.points,
    }

    // Ask HN posts don't have a url, but have a story_text
    if (!story.url && story.story_text) {
      output.push({
        content: story.story_text,
        source: 'Hacker News',
        ...baseStoryOutput,
      })
      continue
    }

    if (!story.url) {
      logger.error(`No url or story text found for story ${story.storyId}`)
      continue
    }

    if (!htmlString) {
      htmlString = await fetch(story.url).then(res => res.text())
      if (!htmlString) {
        logger.info(`No content found for ${story.url}`)
        continue
      }
      await writeToCache(cacheKey, htmlString)
    }

    const { textContent, byline, excerpt, siteName } = await parseSiteContent(htmlString)

    logger.debug({ byline, excerpt, siteName })

    // If siteName or byline is same as title, walk down the chain to find something different
    // split on ' - ' or ' | ' and take the first part
    let source = (siteName || byline || undefined)?.split(/\s[-\\|<>]/)[0]
    const readableUrl = new URL(story.url).hostname.replace('www.', '')

    if (source === story.title) {
      source = readableUrl
    }

    output.push({
      content: textContent,
      url: story.url,
      source: source || readableUrl,
      ...baseStoryOutput,
    })
  }

  return output
}

export async function fetchHnCommentsById(storyId: number): Promise<SlimComment[]> {
  const response = await fetch(`https://hn.algolia.com/api/v1/items/${storyId}`)
  const data = await response.json()
  // Extract only author, children, created_at, and text. Recursively extract children's children.
  const extractComment = (
    c: any,
  ): Pick<Comment, 'author' | 'children' | 'created_at' | 'id' | 'text'> => ({
    id: c.id,
    created_at: c.created_at,
    text: c.text,
    author: c.author,
    children: c.children.map(extractComment),
  })

  return data.children.map(extractComment)
}

export async function fetchStoryDataById(storyId: number) {
  const response = await fetch(`https://hn.algolia.com/api/v1/items/${storyId}`)
  const data = (await response.json()) as StoryDataByIdResponse

  // Extract only author, children, created_at, and text. Recursively extract children's children.
  const extractComment = (
    c: any,
  ): Pick<Comment, 'author' | 'children' | 'created_at' | 'id' | 'text'> => ({
    id: c.id,
    created_at: c.created_at,
    text: c.text,
    author: c.author,
    children: c.children.map(extractComment),
  })

  const comments = data.children.map(extractComment)

  const baseStoryOutput: { text: null | string } & Pick<
    StoryOutput,
    'comments' | 'hnUrl' | 'points' | 'storyId' | 'title'
  > = {
    title: data.title,
    storyId: data.story_id,
    text: data.text,
    points: data.points,
    comments,
    hnUrl: `https://news.ycombinator.com/item?id=${data.story_id}`,
  }

  return {
    ...baseStoryOutput,
    content: data.text,
    url: data.url,
    source: data.author,
  }
}

type StoryDataByIdResponseChildren = {
  author: string
  children: StoryDataByIdResponseChildren[]
  created_at: string
  created_at_i: number
  id: number
  options: string[]
  parent_id: number
  points: null | number
  story_id: number
  text: string
  type: string
}

type StoryDataByIdResponse = {
  author: string
  children: StoryDataByIdResponseChildren[]
  created_at: string
  created_at_i: number
  id: number
  options: string[]
  parent_id: null | number
  points: number
  story_id: number
  text: null | string
  title: string
  type: string
  url: null | string
}
