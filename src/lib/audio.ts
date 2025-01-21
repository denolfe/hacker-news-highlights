import ffmpeg from 'fluent-ffmpeg'
import path from 'path'

import type { StoryDataAggregate, TtsService } from '../types'

import { CACHE_DIR } from '../lib/constants'
import { readFromCache, writeToCache } from '../utils/cache'
import { childLogger, log } from '../utils/log'

const logger = childLogger('AUDIO')
const silence = path.resolve(__dirname, 'silence-1s.mp3')

type PodcastSegment = {
  storyId: string
  summary: string
}

type Chapter = { title: string; start: number; end: number }

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

export async function joinAudioFiles(filenames: string[], outputFilename: string): Promise<void> {
  logger.info(`Merging ${filenames.length} audio files into ${outputFilename}...`)

  // insert silence between segments
  const filesWithSilence = insertBetween(filenames, silence)
  logger.debug({
    filesWithSilence,
  })

  const durations = await calculateDurations(filesWithSilence)
  log.info({ msg: 'DURRATTIONNNSSSSSSSSSSSSSSSSSSSS', durations })

  // Write chapter metadata to file
  const metadataContent = createMetadataContent(durations)
  await writeToCache('chapters.txt', metadataContent)

  await new Promise((resolve, reject) => {
    const command = ffmpeg()

    filesWithSilence
      .map(f => (path.isAbsolute(f) ? f : path.resolve(CACHE_DIR, f)))
      .forEach(file => {
        command.input(file)
      })

    command
      .on('start', cmd => {
        logger.info('FFmpeg command:', cmd)
      })
      .on('end', () => {
        logger.info('Audio files merged')
        resolve('Mp3 merge complete')
      })
      .on('error', err => {
        logger.error('Error occurred:', err)
        reject(err)
      })
      .mergeToFile(outputFilename, CACHE_DIR)
  })

  log.info('Writing metadata to file...')

  // Write metadata to the file
  // ffmpeg -i output.mp3 -i chapters.txt -map_metadata 1 -codec copy output.mp3.chapters.mp3

  await new Promise((resolve, reject) => {
    ffmpeg()
      .on('start', cmd => {
        logger.info('FFmpeg command:', cmd)
      })
      .on('end', () => {
        logger.info('Metadata written to file')
        resolve('Metadata written to file')
      })
      .on('error', err => {
        logger.error('Error occurred:', err)
        reject(err)
      })
      .input(outputFilename)
      .input(path.resolve(CACHE_DIR, 'chapters.txt'))
      .audioCodec('copy')
      .outputOptions('-map_metadata', '1')
      .outputOptions('-metadata', 'title=Hacker News Recap')
      .save(outputFilename + '.chapters.mp3')
  })

  log.info('Audio file created')
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
function createMetadataContent(chapters: Chapter[]): string {
  return (
    `;FFMETADATA1\n` +
    chapters
      .map(
        chapter => `
[CHAPTER]
TIMEBASE=1/1000
START=${Math.floor(chapter.start * 1000)}
END=${Math.floor(chapter.end * 1000)}
title=${chapter.title}
`,
      )
      .join('')
  )
}

function calculateDurations(filenames: string[]): Promise<Chapter[]> {
  return new Promise((resolve, reject) => {
    let currentTime = 0
    const chapters: Chapter[] = []

    const processFile = (index: number) => {
      if (index >= filenames.length) {
        resolve(chapters)
        return
      }

      const file = path.isAbsolute(filenames[index])
        ? filenames[index]
        : path.resolve(CACHE_DIR, filenames[index])
      ffmpeg.ffprobe(file, (err, metadata) => {
        if (err) {
          reject(err as Error)
          return
        }

        const duration = metadata.format.duration || 0
        const title = path.basename(file, path.extname(file))

        chapters.push({
          title,
          start: currentTime,
          end: currentTime + duration,
        })

        currentTime += duration
        processFile(index + 1)
      })
    }

    processFile(0)
  })
}
