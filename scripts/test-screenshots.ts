/**
 * Screenshot capture test script
 *
 * Captures screenshots for test URLs defined in test-screenshots.json
 * and opens them for manual verification.
 *
 * Usage:
 *   pnpm test:screenshots           # Run all tests
 *   pnpm test:screenshots --no-open # Run without opening images
 *   pnpm test:screenshots --clean   # Clear cache before running
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { generateFallbackImage } from '../src/video/fallback.js'
import { captureScreenshot } from '../src/video/screenshots.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type TestUrl = {
  url: string
  issue: string
  fix: string
}

type TestConfig = {
  description: string
  urls: TestUrl[]
}

type Result = {
  id: string
  url: string
  issue: string
  status: 'failed' | 'fallback' | 'screenshot'
  error?: string
}

async function main() {
  const args = process.argv.slice(2)
  const shouldOpen = !args.includes('--no-open')
  const shouldClean = args.includes('--clean')

  // Load test config
  const configPath = path.join(__dirname, 'test-screenshots.json')
  const config: TestConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

  console.log(`\n${config.description}\n`)
  console.log(`Testing ${config.urls.length} URLs...\n`)

  // Clean cache if requested
  if (shouldClean) {
    console.log('Cleaning screenshot cache...\n')
    const cacheDir = path.join(__dirname, '..', 'cache')
    for (const file of fs.readdirSync(cacheDir)) {
      if (file.startsWith('screenshot-test-')) {
        fs.unlinkSync(path.join(cacheDir, file))
      }
    }
  }

  const results: Result[] = []

  for (let i = 0; i < config.urls.length; i++) {
    const { url, issue } = config.urls[i]
    const id = `test-${i.toString().padStart(2, '0')}`
    const domain = new URL(url).hostname.replace('www.', '')

    console.log(`[${i + 1}/${config.urls.length}] ${domain}`)
    console.log(`  Issue: ${issue}`)

    try {
      await captureScreenshot({ url, storyId: id })
      console.log(`  ✓ Screenshot captured\n`)
      results.push({ id, url, issue, status: 'screenshot' })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.log(`  ✗ Screenshot failed: ${errorMsg}`)

      try {
        const title = domain
        await generateFallbackImage({ title, source: domain, storyId: id })
        console.log(`  ✓ Fallback generated\n`)
        results.push({ id, url, issue, status: 'fallback' })
      } catch (fallbackError) {
        const fallbackMsg =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        console.log(`  ✗ Fallback failed: ${fallbackMsg}\n`)
        results.push({ id, url, issue, status: 'failed', error: fallbackMsg })
      }
    }
  }

  // Print summary
  const screenshots = results.filter(r => r.status === 'screenshot')
  const fallbacks = results.filter(r => r.status === 'fallback')
  const failed = results.filter(r => r.status === 'failed')

  console.log('\n=== SUMMARY ===')
  console.log(`Screenshots: ${screenshots.length}`)
  console.log(`Fallbacks:   ${fallbacks.length}`)
  if (fallbacks.length > 0) {
    for (const f of fallbacks) {
      console.log(`  - ${new URL(f.url).hostname} (${f.issue})`)
    }
  }
  console.log(`Failed:      ${failed.length}`)
  if (failed.length > 0) {
    for (const f of failed) {
      console.log(`  - ${new URL(f.url).hostname}: ${f.error}`)
    }
  }

  // Open images for verification
  if (shouldOpen && results.length > 0) {
    console.log('\nOpening screenshots for verification...')
    const cacheDir = path.join(__dirname, '..', 'cache')
    execSync(`open ${cacheDir}/screenshot-test-*.png`)
  }

  // Exit with error if any failed completely
  if (failed.length > 0) {
    process.exit(1)
  }
}

main().catch(console.error)
