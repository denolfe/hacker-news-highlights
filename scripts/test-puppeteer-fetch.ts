/**
 * Test script to compare Puppeteer vs plain fetch for content extraction.
 * Run with: pnpm tsx scripts/test-puppeteer-fetch.ts
 */
import type { PuppeteerExtra } from 'puppeteer-extra'

import { Readability } from '@mozilla/readability'
import { JSDOM, VirtualConsole } from 'jsdom'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer-extra') as PuppeteerExtra
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker').default

puppeteer.use(StealthPlugin())
puppeteer.use(AdblockerPlugin({ blockTrackers: true }))

const FAILED_URLS = [
  {
    id: '46767668',
    url: 'https://twitter.com/lellouchenico/status/2015775970330882319',
    issue: 'Twitter (French post) - retry',
  },
]

function parseWithReadability(html: string): { textContent: string; title: string } | null {
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('error', () => {})
  const dom = new JSDOM(html, { virtualConsole })
  const result = new Readability(dom.window.document).parse()
  if (!result) {return null}
  return {
    textContent: result.textContent ?? '',
    title: result.title ?? '',
  }
}

async function fetchWithPuppeteer(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    // Try networkidle0 first, fall back to domcontentloaded
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
    } catch (err) {
      if (err instanceof Error && err.message.includes('timeout')) {
        console.log('  networkidle0 timeout, retrying with domcontentloaded...')
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
      } else {
        throw err
      }
    }

    // Extra wait for SPAs
    await new Promise(r => setTimeout(r, 3000))

    return await page.content()
  } finally {
    await browser.close()
  }
}

async function main() {
  const results: Array<{
    id: string
    url: string
    issue: string
    puppeteerSuccess: boolean
    contentLength: number
    excerpt: string
  }> = []

  for (const { id, url, issue } of FAILED_URLS) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing: ${id} - ${url}`)
    console.log(`Original issue: ${issue}`)

    try {
      const html = await fetchWithPuppeteer(url)
      const parsed = parseWithReadability(html)

      const textContent = parsed?.textContent || ''
      const contentLength = textContent.length
      const success = contentLength > 500

      console.log(`Content length: ${contentLength} chars`)
      console.log(`Success: ${success ? '✅ YES' : '❌ NO'}`)

      console.log(`Full text: ${textContent.replace(/\s+/g, ' ')}`)

      results.push({
        id,
        url,
        issue,
        puppeteerSuccess: success,
        contentLength,
        excerpt: textContent.slice(0, 300).replace(/\s+/g, ' '),
      })
    } catch (error) {
      console.log(`Error: ${error instanceof Error ? error.message : String(error)}`)
      results.push({
        id,
        url,
        issue,
        puppeteerSuccess: false,
        contentLength: 0,
        excerpt: `Error: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  // Output markdown summary
  console.log('\n\n## Puppeteer Fetch Test Results\n')
  console.log('| Story ID | Original Issue | Puppeteer | Content Length | Notes |')
  console.log('|----------|----------------|-----------|----------------|-------|')
  for (const r of results) {
    const status = r.puppeteerSuccess ? '✅ Success' : '❌ Failed'
    const notes = r.puppeteerSuccess ? r.excerpt.slice(0, 50) + '...' : r.excerpt.slice(0, 50)
    console.log(`| ${r.id} | ${r.issue} | ${status} | ${r.contentLength} | ${notes} |`)
  }
}

main().catch(console.error)
