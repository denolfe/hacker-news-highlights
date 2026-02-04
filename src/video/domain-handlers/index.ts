import type { DomainHandler } from './types.js'

const YOUTUBE_PATTERN = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//
const GITHUB_PATTERN = /^https?:\/\/github\.com\//
const TWITTER_PATTERN = /^https?:\/\/(?:(?:mobile\.)?twitter\.com|x\.com)\//

const youtubeHandler: DomainHandler = {
  type: 'youtube',
  handle: () => Promise.reject(new Error('Not implemented')),
}

const githubHandler: DomainHandler = {
  type: 'github',
  handle: () => Promise.reject(new Error('Not implemented')),
}

const twitterHandler: DomainHandler = {
  type: 'twitter',
  handle: () => Promise.reject(new Error('Not implemented')),
}

export function getDomainHandler(url: string): DomainHandler | null {
  if (YOUTUBE_PATTERN.test(url)) {
    return youtubeHandler
  }
  if (GITHUB_PATTERN.test(url)) {
    return githubHandler
  }
  if (TWITTER_PATTERN.test(url)) {
    return twitterHandler
  }
  return null
}
