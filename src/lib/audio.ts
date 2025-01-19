import ffmpeg from 'fluent-ffmpeg'
import path from 'path'

import type { StoryDataAggregate, TtsService } from '../types'

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
  ttsService: TtsService,
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
      const buffer = await ttsService.convert(story.summary as string)
      logger.info(`Audio file generated: ${filename}`)
      await writeToCache(filename, buffer)
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
