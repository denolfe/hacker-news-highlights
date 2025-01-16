import path from 'path'
import { loadEnvFile } from 'process'
import { generatePodcastIntro, summarize } from './ai'
import { fetchTopStories } from './hn'
import { generateAudioFromText } from './audio'
import { createDataDir } from './utils/createDataDir'
import { joinAudioFiles } from './utils/joinAudioFiles'
import { DATA_DIR, podcastOutro as outro } from './constants'

loadEnvFile(path.resolve(__dirname, '../.env'))

const args = process.argv.slice(2)

async function main() {
  await createDataDir()
  const storyData = await fetchTopStories(args[0] ? parseInt(args[0]) : 10)
  const intro = await generatePodcastIntro(storyData)
  const summaries = await summarize(storyData)
  summaries.unshift(intro)
  summaries.push(outro)
  const audioFilenames = await generateAudioFromText(summaries)
  await joinAudioFiles(audioFilenames, path.resolve(DATA_DIR, 'output.mp3'))
  console.log('Done!')
}

void main()
