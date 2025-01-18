import { Readability } from '@mozilla/readability'
import { JSDOM, VirtualConsole } from 'jsdom'
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

    let parsed: ReturnType<typeof Readability.prototype.parse> | undefined

    const virtualConsole = new VirtualConsole()
    virtualConsole.on('error', () => {
      // Ignore errors, keeps the output clean
      // https://github.com/jsdom/jsdom/issues/2230#issuecomment-466915328
    })
    const dom = new JSDOM(htmlString, { virtualConsole })
    parsed = new Readability(dom.window.document).parse()

    const { textContent, byline, excerpt, siteName } = parsed ?? {
      textContent: 'No content found for this story',
      byline: '',
      excerpt: '',
    }

    log.info({ byline, excerpt, siteName })

    const comments = await fetchStoryDataById(hit.storyId)
    output.push({
      content: textContent,
      comments,
      title: hit.title,
      url: hit.url,
      storyId: hit.storyId,
      // strip http(s), parse just the domain from the url
      source: siteName ?? byline ?? new URL(hit.url).hostname.replace('www.', ''),
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
