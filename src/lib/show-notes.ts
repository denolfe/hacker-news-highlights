import path from 'path'

import type { StoryDataAggregate } from '../types'

import { writeToFile } from '../utils/writeToFile'
import { OUTPUT_DIR } from './constants'

export async function generateShowNotes({
  stories,
  introText,
}: {
  stories: StoryDataAggregate[]
  introText: string
}) {
  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })

  let showNotes = `This is a recap of the top 10 posts on Hacker News on ${formattedDate}.\n\n`
  showNotes += stories
    .map(story => {
      let str = `${story.title}\nHN: ${story.hnUrl}\n`
      if (story.url) {
        str += `Link: ${story.url}\n`
      }
      return str
    })
    .join('\n')

  showNotes += `\n\nTranscript:\n${introText}\n${stories.map(s => s.summary).join('\n\n')}`

  await writeToFile(path.resolve(OUTPUT_DIR, 'show-notes.txt'), showNotes)
}
