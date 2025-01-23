import fs from 'fs/promises'

import { log } from '../utils/log'

const showId = '60573'
const baseUrl = 'https://api.transistor.fm/v1'

export async function uploadPodcast(args: {
  audioFilePath: string
  title: string
  showNotes: string
}) {
  log.info('Uploading podcast...')
  const { audioFilePath, title, showNotes } = args

  const apiKey = process.env.TRANSISTOR_API_KEY!
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  }

  const filename = audioFilePath.split('/').pop()

  // Authorize upload
  log.info(`Authorizing upload for ${filename}...`)
  const authorizeRes = (await fetch(`${baseUrl}/episodes/authorize_upload?filename=${filename}`, {
    method: 'GET',
    headers,
  }).then(res => {
    log.info(`Authorize upload response: ${res.status}`)
    return res.json()
  })) as AuthorizeUploadResponse | undefined

  if (!authorizeRes?.data?.attributes.upload_url || !authorizeRes.data.attributes.audio_url) {
    log.info({ authorizeRes })
    throw new Error('Failed to authorize upload')
  }

  const {
    data: {
      attributes: { audio_url, upload_url },
    },
  } = authorizeRes

  log.info({
    upload_url,
    audio_url,
  })

  // Upload file
  const fileData = await fs.readFile(audioFilePath)
  const uploadRes = await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'audio/mpeg',
    },
    body: fileData,
  })

  log.info({ uploadResOk: uploadRes.ok, uploadResStatus: uploadRes.status })

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload file, status: ${uploadRes.status}, ${uploadRes.statusText}`)
  }

  log.info(`File uploaded successfully.`)

  // Create episode
  const episode: Episode = {
    show_id: showId,
    title,
    description: showNotes.replace(/\n/g, '<br>'),
    audio_url,
    increment_number: true,
  }

  log.info(`Creating episode...`, episode)

  const podcastResponse = (await fetch(`${baseUrl}/episodes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      episode,
    }),
  }).then(res => {
    log.info(`Create episode response: ${res.status}`)
    return res.json()
  })) as { data?: { id?: string } }

  const episodeId = podcastResponse?.data?.id

  if (!episodeId) {
    throw new Error('Failed to create episode')
  }
  log.info(`Created episode with ID: ${episodeId}`)

  // Publish episode
  log.info(`Publishing episode...`)
  const publishRes = await fetch(`${baseUrl}/episodes/${episodeId}/publish`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      id: episodeId,
      episode: {
        status: 'published',
      },
    }),
  }).then(res => {
    log.info({ res, status: res.status, ok: res.ok })
    return res.json()
  })

  log.deep({ publishResponse: JSON.stringify(publishRes) })
  log.info(`Published episode with ID: ${episodeId}`)
}

type Episode = {
  /** ID or Slug of the Show to add an episode to */
  show_id: string
  /** URL to an episode's new audio file */
  audio_url?: string
  /** Full text of the episode transcript */
  transcript_text?: string
  /** Episode author */
  author?: string
  /**
   * Longer episode description which may contain HTML and unformatted tags for chapters, people, supporters, etc
   *
   * WARNING: Must use HTML-formatted text for this field. Does not respect newlines.
   * */
  description?: string
  /** Episode contains explicit content */
  explicit?: boolean
  /** Episode artwork image URL */
  image_url?: string
  /** Comma-separated list of keywords */
  keywords?: string
  /** Episode number */
  number?: number
  /** Season number */
  season?: number
  /** Episode summary short description */
  summary?: string
  /** Full, trailer, or bonus episode */
  type?: 'bonus' | 'full' | 'trailer'
  /** Episode title */
  title: string
  /** Alternate episode URL overriding the share_url */
  alternate_url?: string
  /** YouTube video URL to be embedded on episode sharing pages and website pages */
  video_url?: string
  /** Private podcast email notifications override (defaults to Show setting) */
  email_notifications?: boolean
  /** Automatically set the number to the next episode number of the current season */
  increment_number: boolean
}

type AuthorizeUploadResponse = {
  data?: {
    id: string
    type: string
    attributes: {
      upload_url: string
      content_type: string
      expires_in: number
      audio_url: string
    }
  }
}
