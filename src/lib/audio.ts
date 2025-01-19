import ffmpeg from 'fluent-ffmpeg'
import path from 'path'

import type { StoryDataAggregate } from '../types'

import { CACHE_DIR } from '../lib/constants'
import { readFromCache, writeToCache } from '../utils/cache'
import { childLogger } from '../utils/log'
import { getElevenLabsClient, getOpenAI as getOpenAIClient } from './clients'

const logger = childLogger('AUDIO')
const silence = path.resolve(__dirname, 'silence-1s.mp3')

type PodcastSegment = {
  storyId: string
  summary: string
}

export async function generateAudioFromText(
  storyData: (PodcastSegment | StoryDataAggregate)[],
): Promise<string[]> {
  const audioFilenames: string[] = []

  for (const [i, story] of storyData.entries()) {
    const filename = `segment-${story.storyId}.mp3`

    const cached = await readFromCache(filename)
    if (cached) {
      logger.info(`[${i + 1}/${storyData.length}] Using cached audio for ${filename}`)
      audioFilenames.push(filename)
      continue
    }

    logger.info(`[${i + 1}/${storyData.length}] Generating audio: ${story.storyId}...`)
    try {
      if (process.env.VOICE_SERVICE === 'elevenlabs') {
        const audioStream = await getElevenLabsClient().textToSpeech.convert(
          '56AoDkrOh6qfVPDXZ7Pt', // Cassidy
          {
            text: story.summary as string,
            model_id: 'eleven_turbo_v2',
          },
        )
        logger.info('Received back audio stream')
        const buffer = await streamToBuffer(audioStream)
        logger.info(`Audio file generated: ${filename}`)
        await writeToCache(filename, buffer)
      } else {
        const mp3 = await getOpenAIClient().audio.speech.create({
          model: 'tts-1-hd',
          voice: 'nova',
          input: story.summary as string,
        })

        const buffer = Buffer.from(await mp3.arrayBuffer())
        logger.info(`Audio file generated: ${filename}`)
        await writeToCache(filename, buffer)
      }

      audioFilenames.push(filename)
    } catch (error) {
      logger.error(`Error generating audio for story: ${story.storyId}\nsummary: ${story.summary}`)
      logger.error(error)
    }
  }

  return audioFilenames
}

export function joinAudioFiles(filenames: string[], outputFilename: string): Promise<void> {
  logger.info(`Merging ${filenames.length} audio files into ${outputFilename}...`)

  // insert silence between segments
  const filesWithSilence = insertBetween(filenames, silence)
  logger.debug({
    filesWithSilence,
  })

  return new Promise((resolve, reject) => {
    const command = ffmpeg()

    filesWithSilence
      .map(f => (path.isAbsolute(f) ? f : path.resolve(CACHE_DIR, f)))
      .forEach(file => {
        command.input(file)
      })

    command
      .on('end', () => {
        logger.info('Audio files merged')
        resolve()
      })
      .on('error', err => {
        logger.error('Error occurred:', err)
        reject(err)
      })
      .mergeToFile(outputFilename, CACHE_DIR)
  })
}

function insertBetween(array: string[], itemToInsert: string): string[] {
  return array.reduce((acc, current, index) => {
    if (index > 0) {
      acc.push(itemToInsert)
    }
    acc.push(current)
    return acc
  }, [] as string[])
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: (Buffer | string)[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks as Buffer[])
}
