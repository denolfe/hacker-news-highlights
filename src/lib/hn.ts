import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { Comment, ResponseData, SlimComment, StoryOutput } from '../types'
import { readFromCache, writeToCache } from '../utils/cache'
import { log } from '../utils/log'

export async function fetchTopStories(count: number = 10): Promise<StoryOutput[]> {
  log.info(`Fetching top ${count} stories...`)
  const response = await fetch(
    `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${count}`,
  )
  const data = (await response.json()) as ResponseData

  // Extract only the data we need
  const slim = data.hits.map(s => ({
    title: s.title,
    url: s.url,
    storyId: s.story_id,
  }))

  // Fetch the content and comments for each story
  const output: StoryOutput[] = []
  for (const hit of slim) {
    log.info(`Fetching - ${hit.title} - ${hit.url}`)

    let htmlString = await readFromCache(hit.storyId.toString())
    if (!htmlString) {
      htmlString = await fetch(hit.url).then(res => res.text())
      if (!htmlString) {
        log.info(`No content found for ${hit.url}`)
        continue
      }
      await writeToCache(hit.storyId.toString(), htmlString)
    }

    const dom = new JSDOM(htmlString)
    let parsedArticleText = new Readability(dom.window.document).parse()?.textContent

    if (!parsedArticleText) {
      parsedArticleText = 'No content found'
    }

    const comments = await fetchStoryDataById(hit.storyId)
    output.push({
      content: parsedArticleText,
      comments,
      title: hit.title,
      url: hit.url,
      storyId: hit.storyId,
    })
  }

  return output
}

async function fetchStoryDataById(storyId: number): Promise<SlimComment[]> {
  const response = await fetch(`https://hn.algolia.com/api/v1/items/${storyId}`)
  const data = await response.json()
  // Extract only author, children, created_at, and text. Recursively extract children's children.
  const extractComment = (
    c: any,
  ): Pick<Comment, 'id' | 'created_at' | 'text' | 'children' | 'author'> => ({
    id: c.id,
    created_at: c.created_at,
    text: c.text,
    author: c.author,
    children: c.children.map(extractComment),
  })

  return data.children.map(extractComment)
}
