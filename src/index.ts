import path from 'path'
import { loadEnvFile } from 'process'
import { generatePodcastIntro, summarize } from './lib/ai'
import { fetchTopStories } from './lib/hn'
import { generateAudioFromText } from './lib/audio'
import { joinAudioFiles } from './utils/joinAudioFiles'
import { CACHE_DIR, podcastOutro as outro } from './lib/constants'
import { initCacheDir } from './utils/cache'
import { log } from './utils/log'
import { generateShowNotes } from './lib/show-notes'

loadEnvFile(path.resolve(__dirname, '../.env'))

const args = process.argv.slice(2)

async function main() {
  await initCacheDir()
  const storyData = await fetchTopStories(args[0] ? parseInt(args[0]) : 10)
  const intro = await generatePodcastIntro(storyData)
  const summaries = await summarize(storyData)
  const audioFilenames = await generateAudioFromText([
    { summary: intro.text, storyId: intro.cacheKey },
    ...summaries,
    { summary: outro, storyId: 'outro' },
  ])
  await joinAudioFiles(audioFilenames, path.resolve(CACHE_DIR, 'output.mp3'))
  await generateShowNotes({ stories: summaries, introText: intro.text })
  log.info('Done!')
}

void main()
