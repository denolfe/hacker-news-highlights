import type { PuppeteerExtra } from 'puppeteer-extra'

import { mkdir, writeFile } from 'fs/promises'
import { createRequire } from 'module'
import { join } from 'path'

import { captureScreenshot } from '../src/video/screenshots.js'

// puppeteer-extra has CJS/ESM interop issues - use createRequire for CJS modules
const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer-extra') as PuppeteerExtra
const StealthPlugin = require('puppeteer-extra-plugin-stealth')

puppeteer.use(StealthPlugin())

const url = process.argv[2] || 'https://x.com/karpathy/status/2015883857489522876'
const outputDir = 'cache/compare'

async function fetchOgImage(pageUrl: string): Promise<null | string> {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30000 })

    const ogImage = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="og:image"]')
      return meta?.getAttribute('content') || null
    })

    await browser.close()
    return ogImage
  } catch (error) {
    await browser.close()
    throw error
  }
}

async function downloadImage(imageUrl: string, outputPath: string): Promise<void> {
  const response = await fetch(imageUrl)
  const buffer = await response.arrayBuffer()
  await writeFile(outputPath, Buffer.from(buffer))
}

async function main() {
  console.log(`Comparing screenshot vs og:image for:\n${url}\n`)

  await mkdir(outputDir, { recursive: true })

  // Capture screenshot
  console.log('Capturing screenshot...')
  const screenshotPath = await captureScreenshot({ url, storyId: 'compare-test' })
  console.log(`Screenshot saved: ${screenshotPath}`)

  // Fetch og:image
  console.log('\nFetching og:image...')
  const ogImageUrl = await fetchOgImage(url)

  if (ogImageUrl) {
    console.log(`og:image URL: ${ogImageUrl}`)
    const ogImagePath = join(outputDir, 'og-image.png')
    await downloadImage(ogImageUrl, ogImagePath)
    console.log(`og:image saved: ${ogImagePath}`)

    console.log('\n--- Results ---')
    console.log(`Screenshot: ${screenshotPath}`)
    console.log(`og:image:   ${ogImagePath}`)
  } else {
    console.log('No og:image found')
    console.log('\n--- Results ---')
    console.log(`Screenshot: ${screenshotPath}`)
  }
}

main().catch(console.error)
