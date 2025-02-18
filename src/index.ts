import minimist from 'minimist'

import { generateEpisodeTitle, generatePodcastIntro, summarize, summarizeStory } from './lib/ai.js'
import { generateAudioFromText } from './lib/audio.js'
import { EPISODE_OUTPUT } from './lib/constants.js'
import { fetchStoryDataById, fetchTopStories } from './lib/hn.js'
import { getTtsService } from './lib/services.js'
import { generateShowNotes } from './lib/show-notes.js'
import { uploadPodcast } from './lib/upload-podcast.js'
import { initCacheDir } from './utils/cache.js'
import { loadEnvIfExists } from './utils/env.js'
import { filterPronunciation } from './utils/filterPronunciation.js'
import { initOutputDir } from './utils/initOutputDir.js'
import { log } from './utils/log.js'
import { parseSiteContent } from './utils/parseSiteContent.js'

loadEnvIfExists()

const args = minimist(process.argv.slice(2))

async function main() {
  const { count, audio, preview, publish, storyId } = args as {
    count?: number
    // Can pass --no-audio to skip audio generation
    audio?: boolean
    preview?: boolean
    // --publish to upload to podcast host, publishes automatically in CI
    publish?: boolean
    summarizeLink?: string
    storyId?: number
  }

  // TODO: Use zod
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing required env OPENAI_API_KEY')
  }
  if (process.env.CI) {
    if (!process.env.TRANSISTOR_API_KEY) {
      throw new Error('Missing required env TRANSISTOR_API_KEY')
    }
    if (process.env.VOICE_SERVICE === 'elevenlabs' && !process.env.ELEVEN_LABS_API_KEY) {
      throw new Error('Missing required env ELEVEN_LABS_API_KEY')
    }
  }

  await initOutputDir()
  await initCacheDir()
  const ttsService = getTtsService()

  if (args.summarizeLink) {
    log.info('Summarizing link', { url: args.summarizeLink })
    const htmlString = await fetch(args.summarizeLink).then(res => res.text())
    const { textContent, byline, excerpt, siteName } = await parseSiteContent(htmlString)
    log.info({ textContent, byline, excerpt, siteName })
    // TODO: Summarize this with AI
    return
  }

  if (args.storyId) {
    log.info(`Summarizing story: ${args.storyId}`)
    log.info('Fetching story data...')
    const story = await fetchStoryDataById(args.storyId)
    log.info('Summarizing...')
    const summary = await summarizeStory(story)
    if (!summary.summary) {
      log.error('No summary generated')
      return
    }
    const filteredSummary = filterPronunciation(summary.summary)
    log.info(`Summary for ${story.title}:\n\n${filteredSummary}`)
    return
  }

  const storyData = await fetchTopStories(count ?? 10)

  if (preview) {
    log.info(
      '\n' +
        storyData
          .map(story => {
            let str = `${story.title}\nHN: ${story.hnUrl}\n`
            if (story.url) {
              str += `Link: ${story.url}\n`
            }
            str += `Points: ${story.points} | Comments: ${story.comments.length}\n`
            return str
          })
          .join('\n'),
    )
    return
  }

  const intro = await generatePodcastIntro(storyData)
  intro.text = filterPronunciation(intro.text)

  const title = await generateEpisodeTitle(storyData)
  const unfilteredSummaries = await summarize(storyData)
  const summaries = unfilteredSummaries.map(s => {
    return s.summary
      ? {
          ...s,
          summary: filterPronunciation(s.summary),
        }
      : s
  })

  const showNotes = await generateShowNotes({ stories: summaries, introText: intro.text })

  if (audio === false) {
    log.info('SKIPPING audio generation')
  } else {
    await generateAudioFromText(
      [{ summary: intro.text, storyId: intro.cacheKey, title: intro.title }, ...summaries],
      ttsService,
    )
    log.info(`Total character count: ${showNotes.replace(/\s+/g, '').length}`)
    if (process.env.CI || publish === true) {
      await uploadPodcast({
        audioFilePath: EPISODE_OUTPUT,
        title,
        showNotes,
      })
    } else {
      log.info('SKIPPING episode publish')
    }
  }

  log.info('Done!')
}

void main()
