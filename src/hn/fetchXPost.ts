/**
 * Fetches X/Twitter post content without replies, login walls, or other users' posts.
 * Sources, in order: fxtwitter API, syndication API (complete only for short posts),
 * rendered page via browser, cut-off syndication text, no-content placeholder.
 */
import { fetchContentWithBrowser } from '@/browser/fetchContent.js'
import { childLogger } from '@/utils/log.js'
import { JSDOM, VirtualConsole } from 'jsdom'

const logger = childLogger('X')

const X_HOSTNAMES = new Set([
  'mobile.twitter.com',
  'twitter.com',
  'www.twitter.com',
  'www.x.com',
  'x.com',
])

const REQUEST_TIMEOUT_MS = 10_000

type XStatus = { statusId: string; username: string }

type XPost = {
  authorName: string
  /** Paragraphs of post text, including quoted posts and article bodies */
  paragraphs: string[]
}

type FxTwitterAuthor = { name: string; screen_name: string }

type FxTwitterResponse = {
  code: number
  tweet: {
    article?: { content?: { blocks?: { text: string }[] }; title?: string } | null
    author: FxTwitterAuthor
    quote?: { author: FxTwitterAuthor; text: string } | null
    text: string
  } | null
}

type SyndicationResponse = {
  __typename: string
  article?: { preview_text?: string; title?: string } | null
  note_tweet?: { id: string } | null
  quoted_tweet?: { text: string; user: { name: string } }
  text?: string
  user?: { name: string }
}

/** Extracts username and status ID from an X/Twitter post URL; null for other URLs. */
export function parseXStatusUrl(url: string): null | XStatus {
  try {
    const { hostname, pathname } = new URL(url)
    if (!X_HOSTNAMES.has(hostname)) {
      return null
    }
    const match = pathname.match(/^\/(\w+)\/status\/(\d+)/)
    if (!match?.[1] || !match[2]) {
      return null
    }
    return { username: match[1], statusId: match[2] }
  } catch {
    return null
  }
}

/** Fetches an X post and returns minimal HTML for Readability parsing. */
export async function fetchXPostHtml(url: string): Promise<string> {
  const status = parseXStatusUrl(url)
  if (!status) {
    return renderPostHtml(null)
  }

  const fxPost = await fetchFromFxTwitter(status)
  if (fxPost) {
    return renderPostHtml(fxPost)
  }

  const syndication = await fetchFromSyndication(status)
  if (syndication?.isComplete) {
    return renderPostHtml(syndication.post)
  }

  const browserPost = await fetchFromBrowser({ url, status })
  if (browserPost) {
    return renderPostHtml(browserPost)
  }

  return renderPostHtml(syndication?.post ?? null)
}

async function fetchFromFxTwitter(status: XStatus): Promise<null | XPost> {
  try {
    const res = await fetch(
      `https://api.fxtwitter.com/${status.username}/status/${status.statusId}`,
      {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    )
    const data = (await res.json()) as FxTwitterResponse
    const { tweet } = data
    if (!res.ok || !tweet) {
      logger.warning(`fxtwitter returned ${data.code} for ${status.statusId}`)
      return null
    }

    const paragraphs = [tweet.text]
    if (tweet.article) {
      paragraphs.push(
        tweet.article.title ?? '',
        ...(tweet.article.content?.blocks?.map(b => b.text) ?? []),
      )
    }
    if (tweet.quote) {
      paragraphs.push(`Quoting ${tweet.quote.author.name}: ${tweet.quote.text}`)
    }
    return { authorName: tweet.author.name, paragraphs: paragraphs.filter(Boolean) }
  } catch (error) {
    logger.warning(`fxtwitter failed for ${status.statusId}: ${String(error)}`)
    return null
  }
}

/** Syndication cuts long posts and articles to a preview; `isComplete` is false for those. */
async function fetchFromSyndication(
  status: XStatus,
): Promise<{ isComplete: boolean; post: XPost } | null> {
  try {
    const res = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${status.statusId}&token=${syndicationToken(status.statusId)}&lang=en`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    )
    const data = (await res.json()) as SyndicationResponse
    if (!res.ok || data.__typename !== 'Tweet' || !data.user) {
      logger.warning(`Syndication returned ${data.__typename} for ${status.statusId}`)
      return null
    }

    const paragraphs = [data.text ?? '']
    if (data.article) {
      paragraphs.push(data.article.title ?? '', data.article.preview_text ?? '')
    }
    if (data.quoted_tweet) {
      paragraphs.push(`Quoting ${data.quoted_tweet.user.name}: ${data.quoted_tweet.text}`)
    }
    return {
      isComplete: !data.note_tweet && !data.article,
      post: { authorName: data.user.name, paragraphs: paragraphs.filter(Boolean) },
    }
  } catch (error) {
    logger.warning(`Syndication failed for ${status.statusId}: ${String(error)}`)
    return null
  }
}

/**
 * Renders the page and reads only the `article` linking to this status. The page also
 * holds parent posts and replies in sibling `article` elements.
 */
async function fetchFromBrowser(params: { status: XStatus; url: string }): Promise<null | XPost> {
  const { status, url } = params
  try {
    const html = await fetchContentWithBrowser(url)
    const virtualConsole = new VirtualConsole()
    virtualConsole.on('error', () => {})
    const { document } = new JSDOM(html, { virtualConsole }).window

    const linkedPost = [...document.querySelectorAll('article')].find(article =>
      article.querySelector(`a[href$="/status/${status.statusId}"]`),
    )
    const text = linkedPost?.querySelector('div[dir="auto"]')?.textContent?.trim()
    if (!text) {
      logger.warning(`Rendered page has no post for ${status.statusId}`)
      return null
    }
    return { authorName: status.username, paragraphs: [text] }
  } catch (error) {
    logger.warning(`Browser fetch failed for ${status.statusId}: ${String(error)}`)
    return null
  }
}

/** Token the syndication endpoint expects, derived from the status ID. */
function syndicationToken(statusId: string): string {
  return ((Number(statusId) / 1e15) * Math.PI).toString(36).replace(/0+|\./g, '')
}

function renderPostHtml(post: null | XPost): string {
  const { document } = new JSDOM(
    '<!doctype html><html><head></head><body><article></article></body></html>',
  ).window
  const article = document.querySelector('article')
  const paragraphs = post?.paragraphs ?? ['No content found for this story']

  for (const text of paragraphs) {
    const p = document.createElement('p')
    p.textContent = text
    article?.append(p)
  }
  if (post) {
    document.title = `${post.authorName} on X`
    const siteName = document.createElement('meta')
    siteName.setAttribute('property', 'og:site_name')
    siteName.setAttribute('content', 'X')
    document.head.append(siteName)
  }
  return `<!doctype html>${document.documentElement.outerHTML}`
}
