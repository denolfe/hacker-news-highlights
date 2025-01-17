import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { SlimComment, StoryOutput } from '../types'
import { writeToFile } from '../utils/writeToFile'
import { readFromCache, writeToCache } from '../utils/cache'
import { createHash } from 'crypto'
import { log } from '../utils/log'

const storySummarizationPrompt = `
You are an AI language model tasked with generating a recap of a top story from Hacker News (news.ycombinator.com). For the given story, perform the following tasks:

1. State the article title: Clearly announce the title of the article.
2. Summarize the link's content: Provide a concise summary of the article's main points, capturing the essence of the story.
3. Summarize the conversations in the comments: Analyze the comments section to extract key themes, debates, and insights shared by the community.

Instructions for Summarizing Comments:

-  Identify the main topics of discussion in the comments.
-  Highlight any significant debates or differing opinions among users.
-  Note any recurring themes or insights that provide additional context or perspectives on the article.
-  Capture the general sentiment of the community regarding the article and its implications.
-  Avoid including specific usernames or quoting comments verbatim; instead, focus on summarizing the overall discourse.
-  Limit sentence count to 3-5 sentences per section.
-  Use concise language
-  Do NOT use any formatting such as bold or asterisks

**Example Input:**

Title: [Article Title]

Content:
[Article Content]

Comments data:
[comments in a tree structure]

**Expected Output:**

Title: [Article Title], is a [brief description of the article's focus].
[Summary of the article's main points, highlighting key arguments or findings].
In the comments, users discussed [main topics of discussion], focusing on [specific aspects or implications].
They debated [key debates or differing opinions], and shared insights on [recurring themes or additional context].
The general sentiment was [overall sentiment], with users expressing [specific reactions or concerns].
`

export async function summarize(
  stories: StoryOutput[],
): Promise<Array<{ storyId: string; text: string }>> {
  log.info('Summarizing stories...')
  const openai = createOpenAI({
    compatibility: 'strict', // strict mode, enable when using the OpenAI API
    apiKey: process.env.OPENAI_API_KEY,
  })

  log.info('Generating summaries...')

  const summaries: Array<{ storyId: string; text: string }> = []

  for (const story of stories) {
    log.info(`Summarizing story: ${story.title}`)
    try {
      const cacheKey = 'summary-' + story.story_id.toString()
      const cached = await readFromCache(cacheKey)
      if (cached) {
        summaries.push({ storyId: story.story_id.toString(), text: cached })
        continue
      }

      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt:
          storySummarizationPrompt +
          `Title: ${story.title}\n` +
          `Content:\n${story.content}\n` +
          `Comments data:\n${generateCommentTree(story.comments.slice(0, 5))}`,
      })
      summaries.push({ storyId: story.story_id.toString(), text })
      await writeToCache(cacheKey, text)
    } catch (error) {
      console.error('Error generating text:', error)
      await writeToFile('summary.txt', summaries)
    }
  }
  // await writeToFile('summary.txt', summaries.join('\n\n'))

  return summaries
}

export async function generatePodcastIntro(
  stories: StoryOutput[],
): Promise<{ cacheKey: string; text: string }> {
  log.info('Generating podcast intro...')
  const hash = createHash('sha256')
    .update(stories.map(s => s.story_id).join())
    .digest('hex')
    .slice(0, 6)

  const cacheKey = `intro-${hash}`
  const cached = await readFromCache(cacheKey)
  if (cached) {
    log.info(`Using cached intro: ${cacheKey}`)
    return { cacheKey, text: cached }
  }

  const introTemplate = (summary: string) => `
Welcome to the Hacker News recap where we bring you an exclusive overview of the top 10 posts
on Hacker News every day.

Today, we dive into ${summary}.

Let's jump right in.
`
  const openai = createOpenAI({
    compatibility: 'strict', // strict mode, enable when using the OpenAI API
    apiKey: process.env.OPENAI_API_KEY,
  })

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: `
Summarize these 3 stories into a single sentence.

Output in the format: Story 1, Story 2, and Story 3.

Here are the top 3 stories from today's Hacker News recap:

${stories.map(story => `Title: ${story.title}\nContent: ${story.content}\n\n`).join('\n')}
`,
  })

  const intro = introTemplate(text)
  await writeToCache(cacheKey, intro)
  return { cacheKey, text: intro }
}

/**
 * Turn comment json data into a tree structure that takes less tokens but is still readable
 */
function generateCommentTree(comments: SlimComment[]): string {
  let output: string = ''

  const printCommentsTree = (comments: SlimComment[], indent: string = '') => {
    comments.forEach(comment => {
      output += `${indent}${comment.author}: ${comment.text}\n`
      if (comment.children.length > 0) {
        printCommentsTree(comment.children, indent + '\t')
      }
    })
  }

  printCommentsTree(comments, '')
  return output
}
