import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import OpenAI from 'openai'

export const getOpenAI = () =>
  new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

export const getElevenLabsClient = () =>
  new ElevenLabsClient({
    apiKey: process.env.ELEVEN_LABS_API_KEY,
  })
