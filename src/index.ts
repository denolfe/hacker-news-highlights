import path from 'path'
import { loadEnvFile } from 'process'
import { summarize } from './ai'
import { fetchTopStories } from './hn'

loadEnvFile(path.resolve(__dirname, '../.env'))

async function main() {
  const storyData = await fetchTopStories()
  const summary = await summarize(storyData)
}

void main()
