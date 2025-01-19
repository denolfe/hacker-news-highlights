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

loadEnvIfExists(path.resolve(__dirname, '../.env'))

const args = process.argv.slice(2)

async function main() {
  await initOutputDir()
  await initCacheDir()
  const ttsService = getTtsService()
  const storyData = await fetchTopStories(args[0] ? parseInt(args[0]) : 10)
  const intro = await generatePodcastIntro(storyData)
  const summaries = await summarize(storyData)
  const audioFilenames = await generateAudioFromText(
    [
      { summary: intro.text, storyId: intro.cacheKey },
      ...summaries,
      { summary: outro, storyId: 'outro' },
    ],
    ttsService,
  )
  await joinAudioFiles(audioFilenames, path.resolve(OUTPUT_DIR, 'output.mp3'))
  await generateShowNotes({ stories: summaries, introText: intro.text })
  log.info('Done!')
}

void main()
