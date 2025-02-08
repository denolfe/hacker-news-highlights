import type { TtsService } from '../types.js'

import { log } from '../utils/log.js'
import { getElevenLabsClient, getOpenAI } from './clients.js'

export const getTtsService: () => TtsService = () => {
  log.info(`Using voice service: ${process.env.VOICE_SERVICE || 'openai'}`)
  if (process.env.VOICE_SERVICE === 'elevenlabs') {
    const client = getElevenLabsClient()
    return {
      convert: async (text: string) => {
        const audioStream = await client.textToSpeech.convert(
          '56AoDkrOh6qfVPDXZ7Pt', // Cassidy
          {
            text,
            model_id: 'eleven_turbo_v2',
          },
        )
        return await streamToBuffer(audioStream)
      },
    }
  } else {
    const client = getOpenAI()
    return {
      convert: async (text: string) => {
        const mp3 = await client.audio.speech.create({
          model: 'tts-1-hd',
          voice: 'nova',
          input: text,
        })

        return Buffer.from(await mp3.arrayBuffer())
      },
    }
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: (Buffer | string)[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks as Buffer[])
}
