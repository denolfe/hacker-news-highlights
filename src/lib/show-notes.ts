import path from 'path'
import { StoryDataAggregate } from '../types'
import { writeToFile } from '../utils/writeToFile'
import { OUTPUT_DIR } from './constants'

export async function generateShowNotes({
  stories,
  introText,
}: {
  stories: StoryDataAggregate[]
  introText: string
}) {
  let showNotes = stories
    .map(story => {
      return `\n${story.title}\nLink: ${story.url}\nComments: ${story.hnUrl}\n`
    })
    .join('\n')

  showNotes += `\n\nTranscript:\n${introText}\n${stories.map(s => s.summary).join('\n\n')}`

  await writeToFile(path.resolve(OUTPUT_DIR, 'show-notes.txt'), showNotes)
}
