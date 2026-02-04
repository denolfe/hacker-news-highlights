import { launchBrowser } from '@/browser/index.js'
import { CACHE_DIR } from '@/constants.js'
import { cacheExists } from '@/utils/cache.js'
import { log } from '@/utils/log.js'
import path from 'path'

import type { DomainHandlerParams } from './types.js'

export type TweetData = {
  displayName: string
  username: string
  text: string
  avatarUrl: string
}

const NITTER_INSTANCES = ['nitter.net', 'nitter.privacydev.net', 'nitter.poast.org']

export function extractTweetPath(url: string): null | string {
  const match = url.match(/(?:twitter\.com|x\.com)\/([^/]+\/status\/\d+)/)
  return match ? match[1].split('?')[0] : null
}

export async function parseTweetFromNitter(tweetPath: string): Promise<null | TweetData> {
  for (const instance of NITTER_INSTANCES) {
    try {
      const nitterUrl = `https://${instance}/${tweetPath}`
      const response = await fetch(nitterUrl, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HNHighlights/1.0)',
        },
      })

      if (!response.ok) {
        continue
      }

      const html = await response.text()

      const avatarMatch = html.match(/class="avatar[^"]*"[^>]*src="([^"]+)"/)
      const displayNameMatch = html.match(/class="fullname[^"]*"[^>]*>([^<]+)</)
      const usernameMatch = html.match(/class="username[^"]*"[^>]*>([^<]+)</)
      const textMatch = html.match(/class="tweet-content[^"]*"[^>]*>([^<]+)</)

      if (!displayNameMatch || !usernameMatch || !textMatch) {
        continue
      }

      const avatarPath = avatarMatch ? avatarMatch[1] : ''
      const avatarUrl = avatarPath.startsWith('http')
        ? avatarPath
        : `https://${instance}${avatarPath}`

      return {
        displayName: displayNameMatch[1].trim(),
        username: usernameMatch[1].trim(),
        text: textMatch[1].trim(),
        avatarUrl,
      }
    } catch {
      continue
    }
  }

  return null
}

const X_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <path fill="#fff" d="M36.65 3.81h6.77L28.73 20.4 46 44.19H32.21L21.53 30.47 9.37 44.19H2.6l15.68-17.91L2 3.81h14.14l9.66 12.78L36.65 3.81zM34.3 39.96h3.75L13.86 7.64H9.83L34.3 39.96z"/>
</svg>
`

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.slice(0, maxLength - 3) + '...'
}

export async function handleTwitter(params: DomainHandlerParams): Promise<string> {
  const { url, storyId } = params
  const filename = `screenshot-${storyId}.png`
  const filepath = path.resolve(CACHE_DIR, filename)

  if (await cacheExists(filename)) {
    log.info(`[TWITTER] Using cached: ${filename}`)
    return filepath
  }

  const tweetPath = extractTweetPath(url)
  if (!tweetPath) {
    throw new Error(`Could not extract tweet path from URL: ${url}`)
  }

  log.info(`[TWITTER] Fetching tweet via Nitter: ${tweetPath}`)

  const tweetData = await parseTweetFromNitter(tweetPath)
  if (!tweetData) {
    throw new Error(`Could not fetch tweet data for: ${tweetPath}`)
  }

  log.info(`[TWITTER] Generating image for tweet by ${tweetData.username}`)

  const displayText = escapeHtml(truncateText(tweetData.text, 400))

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          width: 1920px;
          height: 1080px;
          background: #000000;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 80px 120px;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          position: relative;
        }
        .header {
          display: flex;
          align-items: center;
          margin-bottom: 40px;
        }
        .avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          margin-right: 24px;
        }
        .names {
          display: flex;
          flex-direction: column;
        }
        .display-name {
          color: white;
          font-size: 32px;
          font-weight: bold;
        }
        .username {
          color: #71767b;
          font-size: 24px;
          margin-top: 4px;
        }
        .tweet-text {
          color: white;
          font-size: 42px;
          line-height: 1.4;
          max-width: 1600px;
        }
        .logo {
          position: absolute;
          bottom: 40px;
          left: 40px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img class="avatar" src="${tweetData.avatarUrl}" alt="" />
        <div class="names">
          <div class="display-name">${escapeHtml(tweetData.displayName)}</div>
          <div class="username">${escapeHtml(tweetData.username)}</div>
        </div>
      </div>
      <div class="tweet-text">${displayText}</div>
      <div class="logo">${X_LOGO_SVG}</div>
    </body>
    </html>
  `

  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 3 })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.screenshot({ path: filepath, type: 'png' })
    log.info(`[TWITTER] Saved: ${filename}`)
    return filepath
  } finally {
    await browser.close()
  }
}
