import { loadEnvFile } from 'process'
import { summarize } from './ai'
import { fetchTopStories } from './hn'
import fs from 'fs/promises'
import path from 'path'

loadEnvFile(path.resolve(__dirname, '../.env'))

async function main() {
  console.log('Hello, World!')
  const storyData = await fetchTopStories()
  await summarize(storyData)

  // Write to a file
  // await fs.writeFile('output.json', JSON.stringify(output, null, 2))

  // await fetchStoryContentAndComments()
  // const data = await fetchStoryDataById(41690302)
  // console.log({ data })
}

void main()
