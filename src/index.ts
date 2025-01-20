import minimist from 'minimist'
import path from 'path'

import { generatePodcastIntro, summarize } from './lib/ai'
import { generateAudioFromText, joinAudioFiles } from './lib/audio'
import { OUTPUT_DIR, podcastOutro as outro } from './lib/constants'
import { fetchTopStories } from './lib/hn'
import { getTtsService } from './lib/services'
import { generateShowNotes } from './lib/show-notes'
import { initCacheDir } from './utils/cache'
import { loadEnvIfExists } from './utils/env'
import { initOutputDir } from './utils/initOutputDir'
import { log } from './utils/log'

loadEnvIfExists()

const args = minimist(process.argv.slice(2))

async function main() {
  const { count, audio, preview } = args as { count?: number; audio?: boolean; preview?: boolean }

  await initOutputDir()
  await initCacheDir()
  const ttsService = getTtsService()
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
  const summaries = await summarize(storyData)

  await generateShowNotes({ stories: summaries, introText: intro.text })

  if (audio === false) {
    log.info('SKIPPING audio generation')
  } else {
    const audioFilenames = await generateAudioFromText(
      [
        { summary: intro.text, storyId: intro.cacheKey },
        ...summaries,
        { summary: outro, storyId: 'outro' },
      ],
      ttsService,
    )
    await joinAudioFiles(audioFilenames, path.resolve(OUTPUT_DIR, 'output.mp3'))
  }

  log.info('Done!')
}

void main()
