import OpenAI from 'openai'

import { StorySummary } from '../types'
import { readFromCache, writeToCache } from '../utils/cache'

export async function generateAudioFromText(storySummaries: StorySummary[]): Promise<string[]> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const audioFilenames: string[] = []

  for (const [i, summary] of storySummaries.entries()) {
    const filename = `segment-${summary.storyId}.mp3`

    const cached = await readFromCache(filename)
    if (cached) {
      console.log(`Using cached audio for ${filename}`)
      audioFilenames.push(filename)
      continue
    }

    console.log(`Generating ${i + 1} of ${storySummaries.length} audio files...`)
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: summary.text,
    })

    const buffer = Buffer.from(await mp3.arrayBuffer())
    console.log(`Audio file generated: ${filename}`)
    await writeToCache(filename, buffer)
    audioFilenames.push(filename)
  }

  return audioFilenames
}
