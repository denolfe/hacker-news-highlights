import { Readability } from '@mozilla/readability'
import { ResponseData, Comment, StoryOutput } from './types'
import { JSDOM } from 'jsdom'

export async function fetchTopStories(): Promise<StoryOutput[]> {
  const response = await fetch(
    // 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=10',
    'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=1',
  )
  const data = (await response.json()) as ResponseData

  // Extract only the data we need
  const slim = data.hits.map(s => ({
    title: s.title,
    url: s.url,
    story_id: s.story_id,
  }))

  // Fetch the content and comments for each story
  const output: StoryOutput[] = []
  for (const hit of slim) {
    console.log(`Fetching ${hit.url}`)
    const htmlString = await fetch(hit.url).then(res => res.text())
    const dom = new JSDOM(htmlString)
    let parsedArticleText = new Readability(dom.window.document).parse()?.textContent

    if (!parsedArticleText) {
      parsedArticleText = 'No content found'
    }

    const comments = await fetchStoryDataById(hit.story_id)
    output.push({
      content: parsedArticleText,
      comments,
      title: hit.title,
      url: hit.url,
      story_id: hit.story_id,
    })
  }

  return output
}

async function fetchStoryDataById(storyId: number): Promise<Comment[]> {
  const response = await fetch(`https://hn.algolia.com/api/v1/items/${storyId}`)
  const data = await response.json()
  return data.children as Comment[]
}
