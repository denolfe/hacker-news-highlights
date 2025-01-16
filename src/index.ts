import path from 'path'
import { loadEnvFile } from 'process'
import { summarize } from './ai'
import { fetchTopStories } from './hn'
import { generateAudioFromText } from './audio'

loadEnvFile(path.resolve(__dirname, '../.env'))

async function main() {
  console.log('Fetching top stories...')
  const storyData = await fetchTopStories(10)
  console.log('Summarizing stories...')
  const summaries = await summarize(storyData)
  console.log('Generating audio...')
  await generateAudioFromText(summaries)
  console.log('Done!')
}

void main()
