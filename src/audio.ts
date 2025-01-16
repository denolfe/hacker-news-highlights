import fs from 'fs/promises'
import path from 'path'
import OpenAI from 'openai'

import { createHash } from 'crypto'
import { directoryOrFileExists } from './utils/directoryOrFileExists'
import { DATA_DIR } from './constants'

export async function generateAudioFromText(summaries: string[]): Promise<string> {
  console.log('Generating audio...')
  const hash = createHash('sha256').update(summaries.join('\n\n')).digest('hex')
  const outputFileWithPrefix = path.resolve(DATA_DIR, `./podcast-${hash}`)

  const fileExists = await directoryOrFileExists(outputFileWithPrefix + '-0.mp3')
  if (fileExists) {
    console.log(`Existing audio file matches hash: ${hash}. Skipping audio generation.`)
    return outputFileWithPrefix
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const splitSummaries = await intelligentSplit(summaries)

  for (const [i, summaryPart] of splitSummaries.entries()) {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'shimmer',
      input: summaryPart.join('\n\n'),
    })

    const buffer = Buffer.from(await mp3.arrayBuffer())
    const filename = `${outputFileWithPrefix}-${i}.mp3`
    console.log(`Writing audio to file to ${filename}`)
    await fs.writeFile(filename, buffer)
  }

  return outputFileWithPrefix
}

async function intelligentSplit(summaries: string[]): Promise<Array<string[]>> {
  const maxCharacters = 4096
  const result: Array<string[]> = []
  let currentSummaries = summaries

  while (currentSummaries.length > 0) {
    let characterCount = 0
    let splitIndex = currentSummaries.length

    for (let i = 0; i < currentSummaries.length; i++) {
      if (characterCount + currentSummaries[i].length > maxCharacters) {
        splitIndex = i
        break
      }
      characterCount += currentSummaries[i].length
    }

    result.push(currentSummaries.slice(0, splitIndex))
    currentSummaries = currentSummaries.slice(splitIndex)

    console.log(`Split at index ${splitIndex}. Remaining summaries: ${currentSummaries.length}`)
  }

  result.map((part, i) => {
    console.log(`Part ${i + 1}: ${part.join('\n').length} characters`)
  })

  return result
}
