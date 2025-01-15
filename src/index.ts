import { fetchTopStories } from './hn'
import fs from 'fs/promises'

async function main() {
  console.log('Hello, World!')
  const output = await fetchTopStories()

  // Write to a file
  await fs.writeFile('output.json', JSON.stringify(output, null, 2))

  // await fetchStoryContentAndComments()
  // const data = await fetchStoryDataById(41690302)
  // console.log({ data })
}

void main()
