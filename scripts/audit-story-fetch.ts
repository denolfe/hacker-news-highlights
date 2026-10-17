/**
 * Runs the daily story fetch path against every URL in the committed test site lists and
 * prints what each fetch layer decided, for manual review of block page detection.
 * Run with: pnpm tsx scripts/audit-story-fetch.ts
 */
import { detectBlockedPage } from '@/browser/detectBlockedPage.js'
import { fetchStoryHtml } from '@/hn/index.js'
import { needsBrowserFetch, parseSiteContent } from '@/hn/parseSiteContent.js'
import { readFileSync } from 'node:fs'

type AuditRow = {
  url: string
  plain: string
  browser: string
  contentLength: number
  snippet: string
}

const URL_SOURCES = [
  'data/benchmark-stress-test.json',
  'data/showcase-episode.json',
  'scripts/test-screenshots.json',
  'docs/content-audit-2026-01-30.md',
  'src/hn/storyFetch.integration.spec.ts',
]

async function main() {
  const urls = collectUrls()
  console.log(`Auditing ${urls.length} URLs`)

  const rows: AuditRow[] = []
  for (const [i, url] of urls.entries()) {
    console.log(`\n[${i + 1}/${urls.length}] ${url}`)
    rows.push(await auditUrl(url))
  }

  console.log('\n| URL | Plain fetch | Browser | Chars | Start of content |')
  console.log('|---|---|---|---|---|')
  for (const row of rows) {
    console.log(
      `| ${row.url} | ${row.plain} | ${row.browser} | ${row.contentLength} | ${row.snippet} |`,
    )
  }
}

async function auditUrl(url: string): Promise<AuditRow> {
  const plain = await describePlainFetch(url)
  const { lines, result } = await captureLogs(async () => {
    try {
      const html = await fetchStoryHtml(url)
      return html ? (await parseSiteContent(html)).textContent : ''
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error))
    }
  })
  if (result instanceof Error) {
    return { url, plain, browser: `threw (${result.name})`, contentLength: 0, snippet: '' }
  }
  const content = (result ?? '').replace(/\s+/g, ' ').trim()
  return {
    url,
    plain,
    browser: describeBrowser(lines),
    contentLength: content.length,
    snippet: content.slice(0, 80).replace(/\|/g, '/'),
  }
}

async function describePlainFetch(url: string): Promise<string> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    const html = await response.text()
    const blocked = detectBlockedPage({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      html,
      requestedUrl: url,
      finalUrl: response.url,
    })
    if (blocked) {
      return `${blocked.reason} (${blocked.detail})`
    }
    return needsBrowserFetch(html) ? `HTTP ${response.status}, thin` : `HTTP ${response.status}`
  } catch (error) {
    return `threw (${error instanceof Error ? error.message : String(error)})`
  }
}

/** Summarizes the browser log lines for one URL; empty when the browser did not run */
function describeBrowser(lines: string[]): string {
  const unusable = lines.find(line => line.includes('Unusable page'))
  if (unusable) {
    return unusable.match(/\(([^)]+)\)/)?.[1] ?? 'unusable'
  }
  const rendered = lines.find(line => line.includes('Rendered'))
  return rendered?.match(/HTTP \d+/)?.[0] ?? '-'
}

/** Runs `fn` and returns the stdout lines it wrote, still echoing them */
async function captureLogs<T>(fn: () => Promise<T>): Promise<{ lines: string[]; result: T }> {
  const lines: string[] = []
  const write = process.stdout.write.bind(process.stdout)
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: never[]) => {
    lines.push(String(chunk))
    return write(chunk, ...rest)
  }) as typeof process.stdout.write
  try {
    return { lines, result: await fn() }
  } finally {
    process.stdout.write = write
  }
}

function collectUrls(): string[] {
  const urls = URL_SOURCES.flatMap(file =>
    [...readFileSync(file, 'utf8').matchAll(/https?:\/\/[^\s"'`|)<>,]+/g)].map(m => m[0]),
  )
  return [...new Set(urls)].filter(isStoryUrl)
}

/** Drops docs links and API endpoints that appear in the source files */
function isStoryUrl(url: string): boolean {
  const { hostname } = new URL(url)
  return !['api.fxtwitter.com', 'hn.algolia.com', 'news.ycombinator.com'].includes(hostname)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
