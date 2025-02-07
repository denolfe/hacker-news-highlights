import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { createHash } from 'crypto'

import type { SlimComment, StoryDataAggregate, StoryOutput } from '../types'

import { readFromCache, writeToCache } from '../utils/cache'
import { childLogger } from '../utils/log'
import { IMPERATIVE_PHRASES, PODCAST_NAME } from './constants'

const logger = childLogger('AI')

const openai = createOpenAI({
  compatibility: 'strict', // strict mode, enable when using the OpenAI API
  apiKey: process.env.OPENAI_API_KEY,
})

const storySummarizationPrompt = `
You are an AI language model tasked with generating a recap of a top story from Hacker News (news.ycombinator.com). For the given story, perform the following tasks:

1. State the article title: Clearly announce the title of the article.
2. Summarize the link's content: Provide a concise summary of the article's main points, capturing the essence of the story.
3. Summarize the conversations in the comments: Analyze the comments section to extract key themes, debates, and insights shared by the community.

Instructions for Summarizing the link's content:

- Limit sentence count to 3-5 sentences for the summary
- Use concise language
- Do NOT use any markdown formatting such as bold or asterisks
- Title and Source lines MUST end with a period.
- For any currency amounts, convert them to words and remove the currency symbol. For example, $10.50 should be written as "ten dollars and fifty cents."; $1.4 billion should be written as "one point four billion."

Instructions for Summarizing Comments:

-  Identify the main topics of discussion in the comments.
-  Highlight any significant debates or differing opinions among users.
-  Note any recurring themes or insights that provide additional context or perspectives on the article.
-  Capture the general sentiment of the community regarding the article and its implications.
-  Avoid including specific usernames or quoting comments verbatim; instead, focus on summarizing the overall discourse.

**Example Input:**

Title: [Article Title]

Source: [Site Name, Byline, or Readable Hostname]

Content:
[Article Content]

Comments data:
[comments in a tree structure]

**Expected Output:**

Title: [Article Title].

Source: [Site Name, Byline, or Readable Hostname].

Is a [brief description of the article's focus].
[Summary of the article's main points, highlighting key arguments or findings].
In the comments, users discussed [main topics of discussion], focusing on [specific aspects or implications].
They debated [key debates or differing opinions], and shared insights on [recurring themes or additional context].
The general sentiment was [overall sentiment], with users expressing [specific reactions or concerns].
`

export async function summarize(stories: StoryDataAggregate[]): Promise<StoryDataAggregate[]> {
  logger.info('Summarizing stories...')

  for (const [i, story] of stories.entries()) {
    logger.info(`[${i + 1}/${stories.length}] Summarizing: ${story.title}`)
    try {
      stories[i] = await summarizeStory(story)
    } catch (error) {
      logger.error('Error generating text:', error)
    }
  }

  return stories
}

export async function summarizeStory(story: StoryDataAggregate): Promise<StoryDataAggregate> {
  const cacheKey = 'summary-' + story.storyId.toString()
  const cached = await readFromCache(cacheKey)
  if (cached) {
    story.summary = cached
    return story
  }

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt:
      storySummarizationPrompt +
      `Title: ${story.title}\n\n` +
      `Source: ${story.source}\n` +
      `Content:\n${story.content}\n` +
      `Comments data:\n${generateCommentTree(story.comments.slice(0, 5))}`,
  })
  story.summary = text
  await writeToCache(cacheKey, text)
  return story
}

export async function generatePodcastIntro(
  stories: StoryOutput[],
): Promise<{ cacheKey: string; text: string; title: string }> {
  logger.info('Generating podcast intro...')
  const hash = createHash('sha256')
    .update(stories.map(s => s.storyId).join())
    .digest('hex')
    .slice(0, 6)

  const cacheKey = `intro-${hash}`
  const cached = await readFromCache(cacheKey)
  if (cached) {
    logger.info(`Using cached intro: ${cacheKey}`)
    return { cacheKey, text: cached, title: 'Intro' }
  }

  const introTemplate = (summary: string) => `
Welcome to the ${PODCAST_NAME}, where we explore the top 10 posts on Hacker News every day.

${summary}

Let's ${IMPERATIVE_PHRASES[Math.floor(Math.random() * IMPERATIVE_PHRASES.length)]}.
`

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: `

Given 3 stories from today's Hacker News:

- Summarize these 3 stories into a single sentence.
- Keep each summary short, concise, and in a similar format for clarity and flow.
- Ensure each summary is independent and does not combine multiple ideas.
- Be sure to change the summaries into the present participle form, using '-ing' verbs to indicate ongoing actions.
- Focus on the main subject or action of each story.
- Remove any extra context that isn't crucial for understanding.

Output in the format: "Today, we dive into [summary 1], [summary 2], and [summary 3].

Here are the top 3 stories from today's Hacker News:

${stories.map(story => `Title: ${story.title}\nContent: ${story.content}\n\n`).join('\n')}
`,
  })

  const intro = introTemplate(text)
  await writeToCache(cacheKey, intro)
  return { cacheKey, text: intro, title: 'Intro' }
}

export async function generatePodcastTitle(stories: StoryOutput[]): Promise<string> {
  logger.info('Generating podcast title...')
  const todaysDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })

  const top3Stories = stories.slice(0, 3)

  const hash = createHash('sha256')
    .update(
      top3Stories
        .map(s => s.storyId)
        .slice(0, 3)
        .join(),
    )
    .digest('hex')
    .slice(0, 6)

  const cacheKey = `title-${hash}`
  const cached = await readFromCache(cacheKey)
  if (cached) {
    logger.info(`Using cached title: ${cacheKey}`)
    return cached
  }

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: `
Given 3 stories from today's Hacker News:

- Summarize each summary into only a few words
- Keep any proper nouns
- The output should be a single sentence

Here are the titles:

${top3Stories.map(story => `- ${story.title}\n`).join('')}
`,
  })

  const title = `${todaysDate} | ${text.replace(/\.$/, '')}`
  logger.info(`Title: ${title}`)
  await writeToCache(cacheKey, title)
  return title
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
