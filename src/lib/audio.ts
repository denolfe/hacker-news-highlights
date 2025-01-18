import OpenAI from 'openai'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'

import { StoryDataAggregate, StorySummary } from '../types'
import { readFromCache, writeToCache } from '../utils/cache'
import { CACHE_DIR, OUTPUT_DIR } from '../lib/constants'
import { childLogger, log } from '../utils/log'

const logger = childLogger('AUDIO')

type PodcastSegment = {
  storyId: string
  summary: string
}

export async function generateAudioFromText(
  storyData: (StoryDataAggregate | PodcastSegment)[],
): Promise<string[]> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const audioFilenames: string[] = []

  for (const [i, story] of storyData.entries()) {
    const filename = `segment-${story.storyId}.mp3`

    const cached = await readFromCache(filename)
    if (cached) {
      logger.info(`Using cached audio for ${filename}`)
      audioFilenames.push(filename)
      continue
    }

    logger.info(`Generating audio for story: ${story.storyId}...`)
    try {
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: 'nova',
        input: story.summary as string,
      })

      const buffer = Buffer.from(await mp3.arrayBuffer())
      logger.info(`Audio file generated: ${filename}`)
      await writeToCache(filename, buffer)
      audioFilenames.push(filename)
    } catch (error) {
      logger.error(`Error generating audio for story: ${story.storyId}\nsummary: ${story.summary}`)
    }
  }

  return audioFilenames
}

export function joinAudioFiles(filenames: string[], outputFilename: string): Promise<void> {
  logger.info(`Merging ${filenames.length} audio files into ${outputFilename}...`)
  return new Promise((resolve, reject) => {
    const command = ffmpeg()

    filenames
      .map(f => path.resolve(CACHE_DIR, f))
      .forEach(file => {
        command.input(file)
      })

    command
      .on('end', () => {
        logger.info('Audio files merged successfully!')
        resolve()
      })
      .on('error', err => {
        console.error('Error occurred:', err)
        reject(err)
      })
      .mergeToFile(outputFilename, CACHE_DIR)
  })
}
