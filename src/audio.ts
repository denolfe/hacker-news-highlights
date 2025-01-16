import fs from 'fs/promises'
import path from 'path'
import OpenAI from 'openai'

const speechFile = path.resolve('./podcast.mp3')

export async function generateAudioFromText(text: string) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  const mp3 = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'shimmer',
    input: text,
  })

  const buffer = Buffer.from(await mp3.arrayBuffer())
  console.log(`Writing audio to file to ${speechFile}`)
  await fs.writeFile(speechFile, buffer)
}
