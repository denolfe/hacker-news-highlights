import path from 'path'
import { loadEnvFile } from 'process'
import { summarize } from './ai'
import { fetchTopStories } from './hn'
import { generateAudioFromText } from './audio'

loadEnvFile(path.resolve(__dirname, '../.env'))

async function main() {
  const storyData = await fetchTopStories(1)
  const summary = await summarize(storyData)
  await generateAudioFromText(summary.join('\n\n'))
}

void main()
