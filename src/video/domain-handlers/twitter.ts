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
}

type OEmbedResponse = {
  author_name: string
  author_url: string
  html: string
}

export async function fetchTweetFromOEmbed(tweetUrl: string): Promise<null | TweetData> {
  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}`
    const response = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as OEmbedResponse

    // Extract username from author_url (e.g., "https://twitter.com/naval" -> "@naval")
    const usernameMatch = data.author_url.match(/twitter\.com\/(\w+)/)
    const username = usernameMatch ? `@${usernameMatch[1]}` : ''

    // Extract tweet text from HTML blockquote (format: <p>text</p>&mdash; Author)
    const textMatch = data.html.match(/<p[^>]*>([^<]+)<\/p>/)
    const text = textMatch ? textMatch[1] : ''

    if (!text) {
      return null
    }

    return {
      displayName: data.author_name,
      username,
      text,
    }
  } catch {
    return null
  }
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

  log.info(`[TWITTER] Fetching tweet via oEmbed: ${url}`)

  const tweetData = await fetchTweetFromOEmbed(url)
  if (!tweetData) {
    throw new Error(`Could not fetch tweet data for: ${url}`)
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
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          position: relative;
        }
        .content {
          max-width: 1200px;
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
          background: #333;
        }
        .names {
          display: flex;
          flex-direction: column;
        }
        .display-name {
          color: white;
          font-size: 36px;
          font-weight: bold;
        }
        .username {
          color: #71767b;
          font-size: 28px;
          margin-top: 8px;
        }
        .tweet-text {
          color: white;
          font-size: 48px;
          line-height: 1.4;
        }
        .logo {
          position: absolute;
          bottom: 40px;
          left: 40px;
        }
      </style>
    </head>
    <body>
      <div class="content">
        <div class="header">
          <img class="avatar" src="https://unavatar.io/twitter/${tweetData.username.replace('@', '')}" alt="" />
          <div class="names">
            <div class="display-name">${escapeHtml(tweetData.displayName)}</div>
            <div class="username">${escapeHtml(tweetData.username)}</div>
          </div>
        </div>
        <div class="tweet-text">${displayText}</div>
      </div>
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
