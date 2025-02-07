import minimist from 'minimist'

import { generatePodcastIntro, generatePodcastTitle, summarize } from './lib/ai'
import { generateAudioFromText } from './lib/audio'
import { EPISODE_OUTPUT } from './lib/constants'
import { fetchTopStories } from './lib/hn'
import { getTtsService } from './lib/services'
import { generateShowNotes } from './lib/show-notes'
import { uploadPodcast } from './lib/upload-podcast'
import { initCacheDir } from './utils/cache'
import { loadEnvIfExists } from './utils/env'
import { filterPronunciation } from './utils/filterPronunciation'
import { initOutputDir } from './utils/initOutputDir'
import { log } from './utils/log'
import { parseSiteContent } from './utils/parseSiteContent'

loadEnvIfExists()

const args = minimist(process.argv.slice(2))

async function main() {
  const { count, audio, preview, publish } = args as {
    count?: number
    // Can pass --no-audio to skip audio generation
    audio?: boolean
    preview?: boolean
    // --publish to upload to podcast host, publishes automatically in CI
    publish?: boolean
    summarizeLink?: string
  }

  // TODO: Use zod
  if (process.env.CI) {
    if (!process.env.TRANSISTOR_API_KEY) {
      throw new Error('Missing required env TRANSISTOR_API_KEY')
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
  const title = await generatePodcastTitle(storyData)
  const unfilteredSummaries = await summarize(storyData)
  const summaries = unfilteredSummaries.filter(s => {
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
