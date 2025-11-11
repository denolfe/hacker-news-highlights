import type { StoryDataAggregate, TtsService } from '@/types.js'

import {
  CACHE_DIR,
  EPISODE_OUTPUT,
  PODCAST_NAME,
  podcastOutro,
  podcastOutroWithGitHub,
} from '@/constants.js'
import { readFromCache, writeToCache } from '@/utils/cache.js'
import { childLogger, log } from '@/utils/log.js'
import ffmpeg from 'fluent-ffmpeg'
import { fileURLToPath } from 'node:url'
import path from 'path'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const logger = childLogger('AUDIO')
const silenceAudioPath = path.resolve(dirname, 'silence-1s.mp3')

const silenceAudioSegment: PodcastSegmentWithAudio = {
  audioFilename: silenceAudioPath,
  title: 'Silence',
  summary: 'Silence',
  isSilence: true,
}

type PodcastSegment = {
  title: string
  storyId: string
  summary: string
}

type PodcastSegmentWithAudio = { audioFilename: string; isSilence?: boolean } & Omit<
  PodcastSegment,
  'storyId'
>

type Chapter = { title: string; start: number; end: number }

export async function generateAudioFromText(
  storyData: (PodcastSegment | StoryDataAggregate)[],
  ttsService: TtsService,
): Promise<void> {
  const segments: PodcastSegmentWithAudio[] = []

  for (const [i, story] of storyData.entries()) {
    const filename = `segment-${story.storyId}.mp3`

    const cached = await readFromCache(filename)
    if (cached) {
      logger.info(`[${i + 1}/${storyData.length}] Using cached audio for ${filename}`)
      segments.push({
        audioFilename: path.resolve(CACHE_DIR, filename),
        title: story.title,
        summary: story.summary as string,
      })
      continue
    }

    logger.info(`[${i + 1}/${storyData.length}] Generating audio: ${story.storyId}...`)
    try {
      const buffer = await ttsService.convert(story.summary as string)
      logger.info(`Audio file generated: ${filename}`)
      await writeToCache(filename, buffer)
      segments.push({
        audioFilename: path.resolve(CACHE_DIR, filename),
        title: story.title,
        summary: story.summary as string,
      })
    } catch (error) {
      logger.error(`Error generating audio for story: ${story.storyId}\nsummary: ${story.summary}`)
      logger.error(error)
    }
  }

  // Use outro with github on Monday episodes, all others use regular outro
  if (new Date().getDay() === 1) {
    segments.push({
      audioFilename: path.resolve(dirname, 'outro-with-github.mp3'),
      title: 'Outro',
      summary: podcastOutroWithGitHub,
    })
  } else {
    segments.push({
      audioFilename: path.resolve(dirname, 'outro.mp3'),
      title: 'Outro',
      summary: podcastOutro,
    })
  }

  await joinAudioFiles(segments, EPISODE_OUTPUT)
}

export async function joinAudioFiles(
  segments: PodcastSegmentWithAudio[],
  outputFilename: string,
): Promise<void> {
  logger.info(`Merging ${segments.length} audio files into ${outputFilename}...`)

  // insert silence between segments
  const segmentsWithSilence = insertBetween(segments, silenceAudioSegment)
  logger.debug({
    filesWithSilence: segmentsWithSilence,
  })

  const durations = await calculateChapters(segmentsWithSilence)
  log.info({ durations })

  // Write chapter metadata to file
  const metadataContent = createMetadataContent(durations)
  await writeToCache('chapters.txt', metadataContent)

  const noChapterOutputFilename = path.resolve(CACHE_DIR, 'output-no-chapters.mp3')

  await new Promise((resolve, reject) => {
    const command = ffmpeg()

    segmentsWithSilence
      .map(f => f.audioFilename)
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
      .audioBitrate('192k')
      .mergeToFile(noChapterOutputFilename, CACHE_DIR)
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
      .input(noChapterOutputFilename)
      .input(path.resolve(CACHE_DIR, 'chapters.txt'))
      .audioCodec('copy')
      .outputOptions('-map_metadata', '1')
      .outputOptions('-metadata', `title=${PODCAST_NAME}`)
      .audioBitrate('192k')
      .save(outputFilename)
  })

  log.info('Audio file created')
}

function insertBetween(
  array: PodcastSegmentWithAudio[],
  itemToInsert: PodcastSegmentWithAudio,
): PodcastSegmentWithAudio[] {
  return array.reduce((acc, current, index) => {
    if (index > 0) {
      acc.push(itemToInsert)
    }
    acc.push(current)
    return acc
  }, [] as PodcastSegmentWithAudio[])
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

function calculateChapters(segments: PodcastSegmentWithAudio[]): Promise<Chapter[]> {
  return new Promise((resolve, reject) => {
    let currentTime = 0
    const chapters: Chapter[] = []

    const processFile = (i: number) => {
      if (i >= segments.length) {
        resolve(chapters)
        return
      }

      ffmpeg.ffprobe(segments[i].audioFilename, (err, metadata) => {
        if (err) {
          reject(err as Error)
          return
        }

        const duration = metadata.format.duration || 0

        // If it's silence, just skip to the next file
        if (segments[i].isSilence) {
          currentTime += duration
          processFile(i + 1)
          return
        }

        chapters.push({
          title: segments[i].title,
          start: currentTime,
          end: currentTime + duration,
        })

        currentTime += duration
        processFile(i + 1)
      })
    }

    processFile(0)
  })
}
