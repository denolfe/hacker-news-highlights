import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { createHash } from 'crypto'

import type { SlimComment, StoryDataAggregate, StoryOutput } from '../types.js'

import { IMPERATIVE_PHRASES, PODCAST_NAME } from '../constants.js'
import { readFromCache, writeToCache } from '../utils/cache.js'
import { childLogger, log } from '../utils/log.js'
import { estimateTokens } from './estimateTokens.js'

const logger = childLogger('AI')

const openai = createOpenAI({
  compatibility: 'strict', // strict mode, enable when using the OpenAI API
  apiKey: process.env.OPENAI_API_KEY,
})

const storySummarizationPrompt = `
You are an AI language model tasked with generating a recap of a top story from Hacker News (news.ycombinator.com).
<instructions>
  - State the content's title: Clearly announce the title of the content. Follow the <pronunciation_adjustments>
  - Summarize the link's content: Provide a concise summary of the content's main points, capturing the essence of the story.
  - Summarize the conversations in the comments: Analyze the comments section to extract key themes, debates, and insights shared by the community.
</instructions>
<pronunciation_adjustments>
  - For any currency amounts, convert them to words and remove the currency symbol. For example, $10.50 should be written as "ten dollars and fifty cents."; $1.4 billion should be written as "one point four billion dollars".
  - For any measurements or distances, convert them to words. For example, 5km should be written as "five kilometers"; 670nm should be written as "six hundred seventy nanometers".
  - For any usage of the ~ symbol, convert it to "approximately", "around", or "about" - depending on the context. For example, ~500 should be written as "about five hundred" or "approximately five hundred"; ~200ms should be written as "around two hundred milliseconds" or "approximately two hundred milliseconds".
  - For any version numbers, replace the '.' with the word "point". For example, v2.0 should be written as "version two point oh"; 3.0 should be written as "three point oh"; 3.11 should be written as "three point eleven".
</pronunciation_adjustments>
<content_summary>
  - Limit sentence count to 3-5 sentences for the summary
  - When referring to the content, use the terms "article", "news story", "post", "project", "tweet", or "video" depending on what the content is and where from.
  - Use concise language
  - Do NOT use any markdown formatting such as bold or asterisks
  - Title and Source lines MUST end with a period.
</content_summary>
<comments_summary>
  - Identify the main topics of discussion in the comments.
  - Highlight any significant debates or differing opinions among users.
  - Note any recurring themes or insights that provide additional context or perspectives on the content.
  - Capture the general sentiment of the community regarding the content and its implications.
  - Avoid including specific usernames or quoting comments verbatim; instead, focus on summarizing the overall discourse.
</comments_summary>
<example>
  <input>
    <title>[Content Title]</title>
    <source>[Site Name, Byline, or Readable Hostname]</source>
    <content>[Content]</content>
    <comments_data>[comments in a tree structure]</comments_data>
  </input>
  <expected_output>
    Title: [Content Title].

    Source: [Site Name, Byline, or Readable Hostname].

    The [article, new story, post, project, tweet, video] is a [brief description of the content's focus]. [Summary of the content's main points, highlighting key arguments or findings].

    In the comments, users discussed [main topics of discussion], focusing on [specific aspects or implications]. They debated [key debates or differing opinions], and shared insights on [recurring themes or additional context]. The general sentiment was [overall sentiment], with users expressing [specific reactions or concerns].
  </expected_output>
</example>
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

  const prompt =
    storySummarizationPrompt +
    `<title>${story.title}</title>\n` +
    `<source>${story.source}</source>\n` +
    `<content>${story.content}\n</content>\n` +
    `<comments_data>${generateCommentTree(story.comments)}\n</comments_data>`

  const tokenCount = estimateTokens(prompt)
  logger.info(`Estimated tokens: ${tokenCount}`)

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt,
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

${process.env.VOICE_SERVICE === 'elevenlabs' ? `<break time="0.5s" />` : ''}

Let's ${IMPERATIVE_PHRASES[Math.floor(Math.random() * IMPERATIVE_PHRASES.length)]}.
`

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: `
Given 3 stories from today's Hacker News:

- Summarize these 3 stories into a single sentence.
- Keep each summary a few words long. When content is empty or missing, you MUST derive a summary from the title - never mention that content is missing or absent.
- The order of the summaries should match the order they were presented.
- Ensure each summary is independent and does not combine multiple ideas.
- Be sure to change the summaries into the present participle form, using '-ing' verbs to indicate ongoing actions.
- Focus on the main subject or action of each story.
- Remove any extra context that isn't crucial for understanding.
- For any currency amounts, convert them to words and remove the currency symbol. For example, $10.50 should be written as "ten dollars and fifty cents."; $1.4 billion should be written as "one point four billion dollars".
- For any measurements or distances, convert them to words. For example, 5km should be written as "five kilometers"; 670nm should be written as "six hundred seventy nanometers".

Output in the format: "Today, we dive into [summary 1]... [summary 2]... and [summary 3]."

Here are the top 3 stories from today's Hacker News:

${stories
  .slice(0, 3)
  .map(story => {
    if (!story.content) {
      logger.warning(`Story ${story.storyId} has no content - intro will use title only`)
    }
    const storyTitleAndContent = `Title: ${story.title}\nContent: ${story.content}\n\n`
    const tokenCount = estimateTokens(storyTitleAndContent)
    // gpt-4o-mini max is 128k tokens. prompt tokens 237
    // Remaining tokens of 127,763, divided by 3 stories = ~42,500 tokens per story
    // Only use the title if the content is too long
    return tokenCount > 42_500 ? `Title: ${story.title}\n\n` : storyTitleAndContent
  })
  .join('\n')}
`,
  })

  const intro = introTemplate(text)
  log.info(`Intro: ${intro}`)
  await writeToCache(cacheKey, intro)
  return { cacheKey, text: intro, title: 'Intro' }
}

export async function generateEpisodeTitle(stories: StoryOutput[]): Promise<string> {
  logger.info('Generating podcast title...')

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
    logger.info(`Using cached title: ${cached}`)
    return cached
  }

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: `
Given 3 story titles from today's Hacker News:

- Summarize each summary into only a few words
- Keep any proper nouns
- The output should be a single sentence
- The sentence should use commas to separate each story's summary

Here are the titles:

${top3Stories.map(story => `- ${story.title}\n`).join('')}
`,
  })

  const todaysDate = new Date()
    .toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
      timeZone: 'America/New_York',
    })
    .split('/')
    .join('.')

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
