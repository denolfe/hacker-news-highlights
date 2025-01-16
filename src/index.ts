import path from 'path'
import { loadEnvFile } from 'process'
import { summarize } from './ai'
import { fetchTopStories } from './hn'
import { generateAudioFromText } from './audio'
import { createDataDir } from './utils/createDataDir'
import { joinAudioFiles } from './utils/joinAudioFiles'
import { DATA_DIR } from './constants'

loadEnvFile(path.resolve(__dirname, '../.env'))

async function main() {
  await createDataDir()
  const storyData = await fetchTopStories(10)
  const summaries = await summarize(storyData)
  const audioFilenames = await generateAudioFromText(summaries)
  await joinAudioFiles(audioFilenames, path.resolve(DATA_DIR, 'output.mp3'))
  console.log('Done!')
}

void main()
