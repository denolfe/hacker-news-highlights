import fs from 'fs/promises'
import OpenAI from 'openai'
import path from 'path'

import { createHash } from 'crypto'
import { DATA_DIR } from './constants'

export async function generateAudioFromText(summaries: string[]): Promise<string[]> {
  console.log('Generating audio...')
  const hash = createHash('sha256').update(summaries.join('\n\n')).digest('hex')
  const filenamePrefix = `podcast-${hash}`

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const audioFilenames: string[] = []

  for (const [i, summary] of summaries.entries()) {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: summary,
    })

    const buffer = Buffer.from(await mp3.arrayBuffer())
    const filename = `${filenamePrefix}-${i}.mp3`
    console.log(`Writing audio to file to ${filename}`)
    await fs.writeFile(path.resolve(DATA_DIR, filename), buffer)
    audioFilenames.push(filename)
  }

  return audioFilenames
}
