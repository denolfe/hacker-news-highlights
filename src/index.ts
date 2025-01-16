import path from 'path'
import { loadEnvFile } from 'process'
import { summarize } from './ai'
import { fetchTopStories } from './hn'
import { generateAudioFromText } from './audio'
import { createDataDir } from './utils/createDataDir'

loadEnvFile(path.resolve(__dirname, '../.env'))

async function main() {
  await createDataDir()
  const storyData = await fetchTopStories(10)
  const summaries = await summarize(storyData)
  await generateAudioFromText(summaries)
  console.log('Done!')
}

void main()
