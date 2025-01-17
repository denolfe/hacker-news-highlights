import { StoryDataAggregate } from '../types'
import { writeToFile } from '../utils/writeToFile'
import { CACHE_DIR } from './constants'
import path from 'path'

export async function generateShowNotes({
  stories,
  introText,
}: {
  stories: StoryDataAggregate[]
  introText: string
}) {
  let showNotes = stories
    .map(story => {
      return `\n## ${story.title}\n[Original Link](${story.url})\n`
    })
    .join('\n')

  showNotes += `\n\n## Transcript\n${introText}\n${stories.map(s => s.summary).join('\n')}`

  await writeToFile(path.resolve(CACHE_DIR, 'show-notes.txt'), showNotes)
}
