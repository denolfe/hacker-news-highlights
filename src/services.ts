import type { TtsService } from '@/types.js'

import { getElevenLabsClient, getOpenAI } from '@/clients.js'
import { log } from '@/utils/log.js'

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
            modelId: 'eleven_turbo_v2',
            outputFormat: 'mp3_44100_192',
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

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}
