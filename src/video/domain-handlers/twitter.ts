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
    // Text may contain <br>, <a>, etc. so we extract everything between <p> and </p>
    const textMatch = data.html.match(/<p[^>]*>([\s\S]*?)<\/p>/)
    if (!textMatch) {
      return null
    }

    // Strip HTML tags and decode entities
    const text = textMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()

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

async function fetchOEmbedHtml(tweetUrl: string): Promise<null | string> {
  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&theme=dark&dnt=true`
    const response = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as OEmbedResponse
    return data.html
  } catch {
    return null
  }
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

  const embedHtml = await fetchOEmbedHtml(url)
  if (!embedHtml) {
    throw new Error(`Could not fetch tweet embed for: ${url}`)
  }

  log.info(`[TWITTER] Rendering embed widget`)

  // Render the full Twitter embed widget
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          background: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .container {
          transform-origin: center center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${embedHtml}
      </div>
    </body>
    </html>
  `

  const browser = await launchBrowser()
  try {
    /**
     * WARNING: The code below contains hardcoded values instead of shared constants
     * because they seem to break the widget rendering properly.
     */

    const page = await browser.newPage()
    // Start with a tall viewport to measure natural embed size
    await page.setViewport({ width: 1920, height: 2000, deviceScaleFactor: 3 })
    await page.setContent(html, { waitUntil: 'networkidle0' })

    // Wait for Twitter's widget.js to render the embed
    try {
      await page.waitForSelector('twitter-widget, .twitter-tweet-rendered', { timeout: 10000 })
      // Give extra time for images to load
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch {
      log.warning('[TWITTER] Widget may not have fully rendered')
    }

    // Measure the embed size and calculate scale to fit 1920x1080 with padding
    const scale = await page.evaluate(() => {
      const container = document.querySelector('.container') as HTMLElement
      if (!container) {
        return 2.5
      }
      const rect = container.getBoundingClientRect()
      const maxWidth = 1920 - 100 // padding
      const maxHeight = 1080 - 100
      const scaleX = maxWidth / rect.width
      const scaleY = maxHeight / rect.height
      return Math.min(scaleX, scaleY, 3) // cap at 3x
    })

    // Apply calculated scale and set final viewport
    await page.evaluate((s: number) => {
      const container = document.querySelector('.container') as HTMLElement
      if (container) {
        container.style.transform = `scale(${s})`
      }
      document.body.style.width = '1920px'
      document.body.style.height = '1080px'
    }, scale)

    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 3 })
    await page.screenshot({ path: filepath, type: 'png' })
    log.info(`[TWITTER] Saved: ${filename}`)
    return filepath
  } finally {
    await browser.close()
  }
}
