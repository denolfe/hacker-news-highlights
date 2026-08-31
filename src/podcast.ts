import { EPISODE_TITLE_SEPARATOR, getEpisodeDatePrefix } from '@/utils/episodeDate.js'
import { log } from '@/utils/log.js'
import fs from 'fs/promises'

const showId = '60573'
const baseUrl = 'https://api.transistor.fm/v1'

export async function uploadPodcast(args: {
  audioFilePath: string
  title: string
  showNotes: string
  /** Release episode at this time via Transistor scheduled publish; omit to publish immediately */
  publishAt?: Date
}) {
  log.info('Uploading podcast...')
  const { audioFilePath, title, showNotes, publishAt } = args

  const apiKey = process.env.TRANSISTOR_API_KEY!
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  }

  // One episode per Eastern calendar day. Any episode already carrying today's
  // date key means an earlier run got this far, so stop before uploading rather
  // than creating a duplicate.
  const datePrefix = getEpisodeDatePrefix()
  const existing = await findEpisodeForDate({ datePrefix, headers })

  if (existing) {
    throw new Error(
      `Episode already exists for ${datePrefix}: id ${existing.id}, status ${existing.attributes?.status}. Refusing to create a duplicate.`,
    )
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

  if (!authorizeRes?.data?.attributes) {
    log.info({ authorizeRes })
    throw new Error('Failed to authorize upload')
  }

  if (!authorizeRes.data.attributes.upload_url || !authorizeRes.data.attributes.audio_url) {
    log.info({ authorizeRes })
    throw new Error('Failed to authorize upload - missing URLs')
  }

  const {
    data: {
      attributes: { audio_url, upload_url },
    },
  } = authorizeRes

  // Upload file
  const fileData = await fs.readFile(audioFilePath)
  const uploadRes = await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'audio/mpeg',
    },
    body: new Uint8Array(fileData),
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
    description: showNotes
      // Make all URLs clickable
      .replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>')
      // Replace newlines with <br>
      .replace(/\n/g, '<br>'),
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

  // Transistor rejects `scheduled` with a published_at in the past (HTTP 400),
  // which delayed cron delivery causes. Publishing with a past published_at is
  // supported, so release immediately while keeping the intended timestamp for
  // a consistent release time in the feed.
  const isScheduled = Boolean(publishAt && publishAt.getTime() > Date.now())

  if (publishAt && !isScheduled) {
    log.info(`Scheduled time ${publishAt.toISOString()} already passed, publishing immediately`)
  }

  const episodeUpdate: { status: string; published_at?: string } = publishAt
    ? { status: isScheduled ? 'scheduled' : 'published', published_at: publishAt.toISOString() }
    : { status: 'published' }

  log.info(
    isScheduled ? `Scheduling episode for ${publishAt?.toISOString()}...` : 'Publishing episode...',
  )

  const publishRes = await fetch(`${baseUrl}/episodes/${episodeId}/publish`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      id: episodeId,
      episode: episodeUpdate,
    }),
  })

  // Read as text so a non-JSON error body still reaches the logs
  const publishBody = await publishRes.text().catch(() => '')
  const publishJson = safeJsonParse(publishBody) as
    | { data?: { attributes?: { status?: string } } }
    | undefined
  const returnedStatus = publishJson?.data?.attributes?.status

  const isPublishSuccess =
    publishRes.ok && (returnedStatus === episodeUpdate.status || returnedStatus === 'published')

  if (!isPublishSuccess) {
    throw new Error(
      `Failed to publish episode ${episodeId}: HTTP ${publishRes.status}, returned status: ${returnedStatus}, body: ${publishBody || '<empty>'}`,
    )
  }

  log.info(`Episode ${episodeId} ${returnedStatus}`)
}

function safeJsonParse(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

/** Ample for a daily show; the newest page always covers recent days. */
const EPISODE_LOOKUP_PAGE_SIZE = 50

/** Newest episode whose title carries `datePrefix`, in any status, if one exists. */
async function findEpisodeForDate(args: {
  datePrefix: string
  headers: Record<string, string>
}): Promise<EpisodeListEntry | undefined> {
  const { datePrefix, headers } = args
  const url = `${baseUrl}/episodes?show_id=${showId}&order=desc&pagination%5Bper%5D=${EPISODE_LOOKUP_PAGE_SIZE}`

  const res = await fetch(url, { method: 'GET', headers })

  if (!res.ok) {
    throw new Error(`Failed to list episodes: HTTP ${res.status}`)
  }

  const json = (await res.json().catch(() => undefined)) as
    | { data?: EpisodeListEntry[] }
    | undefined

  return json?.data?.find(entry =>
    entry.attributes?.title?.startsWith(`${datePrefix}${EPISODE_TITLE_SEPARATOR}`),
  )
}

type EpisodeListEntry = {
  id?: string
  attributes?: {
    title?: string
    status?: string
  }
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
