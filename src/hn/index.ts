import type { Comment, CoveredStory, ResponseData, SlimComment, StoryOutput } from '@/types.js'

import { getOrCompute, readFromCache, writeToCache } from '@/utils/cache.js'
import { childLogger } from '@/utils/log.js'

import { fetchPdfText } from './fetchPdfText.js'
import { parseSiteContent } from './parseSiteContent.js'

const logger = childLogger('HN')

/** Thrown when a story URL fetch succeeds but yields no usable content. */
class EmptyContentError extends Error {
  constructor(public readonly url: string) {
    super(`No content found for ${url}`)
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

/**
 * Fetches top stories from Hacker News, filters out recently covered stories,
 * and enriches with content and comments.
 */
export async function fetchTopStories(count: number = 10): Promise<StoryOutput[]> {
  logger.info(`Fetching top ${count} stories...`)

  // Fetch additional stories to account for stories covered in previous episodes
  const response = await fetchWithTimeoutAndRetry(
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

  const recentStories = await getRecentlyCoveredStories()
  logger.info(`Found ${recentStories.length} recently covered stories`, {
    coveredStories: recentStories,
  })

  // Filter out stories we have already covered
  const filtered = slim
    .filter(s => {
      const wasCovered = recentStories.some(c => c.id === s.storyId)
      if (wasCovered) {
        logger.warning(`Story ${s.storyId} was covered recently. Removing from list.`)
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

  const newCovered: CoveredStory[] = [
    ...recentStories,
    ...filtered.map(s => ({ id: s.storyId, coveredAt: new Date() })),
  ]
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

    const { url } = story
    let storyContent: string
    try {
      storyContent = await getOrCompute(cacheKey, async () => {
        let content: null | string
        if (url.endsWith('.pdf')) {
          logger.info('Link is a PDF, parsing PDF content...')
          content = await fetchPdfText(url)
        } else {
          content = await fetchWithTimeoutAndRetry(url).then(res => res.text())
        }
        if (!content) {
          throw new EmptyContentError(url)
        }
        return content
      })
    } catch (error) {
      if (error instanceof EmptyContentError) {
        logger.warning(`No content found for ${error.url} - story will be incomplete`)
      } else {
        logger.error(
          `Failed to fetch content for ${url}: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        )
      }
      continue
    }

    const { textContent, byline, excerpt, siteName } = await parseSiteContent(storyContent)
    const source = resolveStorySource({ byline, siteName, title: story.title, url: story.url })

    logger.info({
      msg: 'Parsed site content',
      storyId: story.storyId,
      byline,
      excerpt,
      siteName,
      source,
    })

    output.push({
      content: textContent || excerpt || '',
      url: story.url,
      source,
      ...baseStoryOutput,
    })
  }

  return output
}

/**
 * Fetches all comments for a given story ID from Hacker News API.
 */
export async function fetchHnCommentsById(storyId: number): Promise<SlimComment[]> {
  const response = await fetchWithTimeoutAndRetry(`https://hn.algolia.com/api/v1/items/${storyId}`)
  const data = await response.json()
  return data.children.map(extractComment)
}

/**
 * Fetches complete story data including metadata, content, and comments by story ID.
 */
export async function fetchStoryDataById(storyId: number): Promise<StoryOutput> {
  const response = await fetchWithTimeoutAndRetry(`https://hn.algolia.com/api/v1/items/${storyId}`)
  const data = (await response.json()) as StoryDataByIdResponse
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

/**
 * Picks the spoken source for a story: site name, then byline, cut at the first ' - ' or ' | '.
 * Falls back to the readable hostname when that is missing or repeats the title.
 */
export function resolveStorySource(params: {
  byline?: null | string
  siteName?: null | string
  title: string
  url: string
}): string {
  const { byline, siteName, title, url } = params
  const source = (siteName || byline || undefined)?.split(/\s[-\\|<>]/)[0]
  if (!source || source === title) {
    return new URL(url).hostname.replace('www.', '')
  }
  return source
}

async function fetchWithTimeoutAndRetry(
  url: string,
  timeout: number = 5000,
  retries: number = 3,
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)
    try {
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(id)
      return response
    } catch (error: unknown) {
      clearTimeout(id)
      if (attempt === retries) {
        logger.error(
          `Failed to fetch ${url} after ${retries} attempts: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        )
        logger.error(error)
        throw error
      }
      logger.warning(
        `Attempt ${attempt} failed for ${url}. ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      )
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} attempts`)
}

/** Recursively extracts comment data from HN API response. */
function extractComment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: any,
): Pick<Comment, 'author' | 'children' | 'created_at' | 'id' | 'text'> {
  return {
    id: c.id,
    created_at: c.created_at,
    text: c.text,
    author: c.author,
    children: c.children.map(extractComment),
  }
}

/**
 * Retrieves covered stories from cache and filters out stories that are older than 36 hours.
 */
async function getRecentlyCoveredStories() {
  const covered = await readFromCache('covered-stories')
  const rawCoveredStories: { id: number; coveredAt: string }[] = covered ? JSON.parse(covered) : []

  const coveredStories: CoveredStory[] = rawCoveredStories
    .map(story => {
      // Filter out stories that are older than 36 hours
      const coveredAt = new Date(story.coveredAt)
      if (Date.now() - coveredAt.getTime() > 36 * 60 * 60 * 1000) {
        logger.info(
          `Story ${story.id} was covered more than 36 hours ago. Removing from covered story cache.`,
        )
        return null
      }

      return {
        id: story.id,
        coveredAt,
      }
    })
    .filter((story): story is CoveredStory => story !== null)

  return coveredStories
}
