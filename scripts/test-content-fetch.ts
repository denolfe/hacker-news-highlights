/**
 * Quick test of Puppeteer fallback for content fetching.
 * Run with: pnpm tsx scripts/test-content-fetch.ts
 */
import { parseSiteContent } from '../src/hn/parseSiteContent.js'

const TEST_URLS = [
  { url: 'https://tonystr.net/blog/git_immitation', name: 'SPA (Vue.js)' },
  { url: 'https://simonwillison.net/2026/Jan/26/chatgpt-containers/', name: 'Static blog' },
]

async function main() {
  for (const { url, name } of TEST_URLS) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing: ${name}`)
    console.log(`URL: ${url}`)

    const result = await parseSiteContent(url)
    const textLen = result.textContent?.length ?? 0

    console.log(`Text length: ${textLen}`)
    console.log(`Success: ${textLen > 200 ? '✅' : '❌'}`)
    if (textLen > 0) {
      console.log(`Excerpt: ${result.textContent?.slice(0, 150).replace(/\s+/g, ' ')}...`)
    }
  }
}

main().catch(console.error)
