import type { StoryDataAggregate } from '@/types.js'

import { OUTPUT_DIR } from '@/constants.js'
import { writeToFile } from '@/utils/writeToFile.js'
import path from 'path'

/**
 * Generates show notes and transcript files
 * - Writes show notes to `show-notes.txt`
 * - Writes transcript to `transcript.txt`
 * @returns Show notes
 */
export async function generateShowNotes({
  stories,
  introText,
}: {
  stories: StoryDataAggregate[]
  introText: string
}): Promise<string> {
  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })

  let showNotes = `This is a recap of the top 10 posts on Hacker News on ${formattedDate}.\n\n`

  showNotes += `{{chapters}}\n\n`

  showNotes += stories
    .map(story => {
      let str = `${story.title}\n`
      if (story.url) {
        str += `${story.url}\n`
      }
      str += `${story.hnUrl}\n`
      return str
    })
    .join('\n')

  await writeToFile(path.resolve(OUTPUT_DIR, 'show-notes.txt'), showNotes)

  await writeToFile(
    path.resolve(OUTPUT_DIR, 'transcript.txt'),
    `Transcript:\n${introText}\n${stories.map(s => s.summary).join('\n\n')}`,
  )

  return showNotes
}
