import { createOpenAI, openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { StoryOutput } from './types'
import { writeToFile } from './utils'

const storySummarizationPrompt = `
You are an AI language model tasked with generating a podcast script that recaps the top 10 stories from Hacker News (news.ycombinator.com). For each story, perform the following tasks:

1. **State the article title**: Clearly announce the title of the article.
2. **Summarize the link's content**: Provide a concise summary of the article's main points, capturing the essence of the story.
3. **Summarize the conversations in the comments**: Analyze the comments section to extract key themes, debates, and insights shared by the community.

**Instructions for Summarizing Comments:**

-  Identify the main topics of discussion in the comments.
-  Highlight any significant debates or differing opinions among users.
-  Note any recurring themes or insights that provide additional context or perspectives on the article.
-  Capture the general sentiment of the community regarding the article and its implications.
-  Avoid including specific usernames or quoting comments verbatim; instead, focus on summarizing the overall discourse.

**Example Input:**

Title: [Article Title]

Content:
[Article Content]

Comments data:
[JSON-formatted comments data]

**Expected Output:**

Title: [Article Title], is a [brief description of the article's focus].
[Summary of the article's main points, highlighting key arguments or findings].
In the comments, users discussed [main topics of discussion], focusing on [specific aspects or implications].
They debated [key debates or differing opinions], and shared insights on [recurring themes or additional context].
The general sentiment was [overall sentiment], with users expressing [specific reactions or concerns].
`

// TODO: Summarize each story and its comments
export async function summarize(stories: StoryOutput[]) {
  const openai = createOpenAI({
    compatibility: 'strict', // strict mode, enable when using the OpenAI API
    apiKey: process.env.OPENAI_API_KEY,
  })

  console.log('Generating summary...')

  const { text } = await generateText({
    model: openai('gpt-4-turbo'),
    prompt:
      storySummarizationPrompt +
      stories.map(story => {
        return `
Title: ${story.title}

Content:
${story.content}

Comments data:
${JSON.stringify(story.comments)}
  `
      }),
  })

  await writeToFile('summary-1.txt', text)
}
