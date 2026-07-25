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

/** Slimmed story metadata used to build a StoryOutput. */
type SlimStory = {
  title: string
  url?: null | string
  storyId: number
  story_text?: null | string
  points: number
}

/** Subset of the HN /items/{id} response used to build a SlimStory. */
type StoryItemResponse = {
  title: string
  url: null | string
  story_id: number
  text: null | string
  points: number
}

/**
 * Fetches top stories from Hacker News, filters out recently covered stories,
 * and enriches with content and comments.
 */
export async function fetchTopStories(
  count: number = 10,
): Promise<{ stories: StoryOutput[]; newCovered: CoveredStory[] }> {
  logger.info(`Fetching top ${count} stories...`)

  const { stories: selected, newCovered } = await selectStories(count)

  const stories: StoryOutput[] = []
  for (const [i, story] of selected.entries()) {
    logger.info(`[${i + 1}/${selected.length}] ${story.storyId} - ${story.title} - ${story.url}`)
    const enriched = await enrichStory(story)
    if (enriched) {
      stories.push(enriched)
    }
  }

  return { stories, newCovered }
}

/**
 * Builds a StoryOutput from a slim story: fetches comments and content, then
 * derives the source. Returns null when the story has no usable content.
 */
export async function enrichStory(story: SlimStory): Promise<null | StoryOutput> {
  const comments = await fetchHnCommentsById(story.storyId)

  const baseStoryOutput: Pick<StoryOutput, 'comments' | 'hnUrl' | 'points' | 'storyId' | 'title'> =
    {
      title: story.title,
      storyId: story.storyId,
      comments,
      hnUrl: `https://news.ycombinator.com/item?id=${story.storyId}`,
      points: story.points,
    }

  // Ask HN posts don't have a url, but have a story_text
  if (!story.url && story.story_text) {
    return {
      content: story.story_text,
      source: 'Hacker News',
      ...baseStoryOutput,
    }
  }

  if (!story.url) {
    logger.error(`No url or story text found for story ${story.storyId}`)
    return null
  }

  const { url } = story
  const cacheKey = 'story-' + story.storyId.toString()
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
    return null
  }

  const { textContent, byline, excerpt, siteName } = await parseSiteContent(storyContent)

  // If siteName or byline is same as title, walk down the chain to find something different
  // split on ' - ' or ' | ' and take the first part
  let source = (siteName || byline || undefined)?.split(/\s[-\\|<>]/)[0]
  const readableUrl = new URL(url).hostname.replace('www.', '')

  if (source === story.title) {
    source = readableUrl
  }

  logger.info({
    msg: 'Parsed site content',
    storyId: story.storyId,
    byline,
    excerpt,
    siteName,
    readableUrl,
    source,
  })

  return {
    content: textContent || excerpt || '',
    url,
    source: source || readableUrl,
    ...baseStoryOutput,
  }
}

/**
 * Fetches front-page stories and filters out recently covered and who-is-hiring
 * posts. Returns the selected slim stories plus the covered-stories list to persist.
 */
export async function selectStories(
  count: number,
): Promise<{ stories: SlimStory[]; newCovered: CoveredStory[] }> {
  // Over-fetch to account for stories covered in previous episodes
  const response = await fetchWithTimeoutAndRetry(
    `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${count + 10}`,
  )
  const data = (await response.json()) as ResponseData

  const slim: SlimStory[] = data.hits.map(s => ({
    title: s.title,
    url: s.url,
    storyId: s.story_id,
    story_text: s.story_text,
    points: s.points,
  }))

  const recentStories = await getRecentlyCoveredStories()
  logger.info(`Found ${recentStories.length} recently covered stories`, {
    coveredStories: recentStories,
  })

  const stories = slim
    .filter(s => {
      const wasCovered = recentStories.some(c => c.id === s.storyId)
      if (wasCovered) {
        logger.warning(`Story ${s.storyId} was covered recently. Removing from list.`)
      }
      return !wasCovered
    })
    .filter(s => !/who is hiring/i.test(s.title))
    .slice(0, count)

  logger.debug({ stories })

  if (stories.length < count) {
    const msg = `Not enough stories to cover. Found ${stories.length}, expected ${count}`
    logger.error(msg)
    throw new Error(msg)
  }

  const newCovered: CoveredStory[] = [
    ...recentStories,
    ...stories.map(s => ({ id: s.storyId, coveredAt: new Date() })),
  ]
  logger.debug({ newCovered })

  return { stories, newCovered }
}

/** Persists the covered-stories cache. The caller decides when (CI gate). */
export async function saveCoveredStories(newCovered: CoveredStory[]): Promise<void> {
  await writeToCache('covered-stories', JSON.stringify(newCovered))
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
 * Fetches a single story by ID and builds it through the shared enrich path.
 */
export async function fetchStoryDataById(storyId: number): Promise<StoryOutput> {
  const response = await fetchWithTimeoutAndRetry(`https://hn.algolia.com/api/v1/items/${storyId}`)
  const data = (await response.json()) as StoryItemResponse

  const enriched = await enrichStory({
    title: data.title,
    url: data.url,
    storyId: data.story_id,
    story_text: data.text,
    points: data.points,
  })

  if (!enriched) {
    throw new Error(`No content found for story ${storyId}`)
  }

  return enriched
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
