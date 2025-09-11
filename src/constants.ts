import { fileURLToPath } from 'node:url'
import path from 'path'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const PROJECT_ROOT = path.resolve(dirname, '..')
export const CACHE_DIR = path.resolve(dirname, '../cache')
export const OUTPUT_DIR = path.resolve(dirname, '../output')
export const EPISODE_OUTPUT = path.resolve(OUTPUT_DIR, 'output.mp3')
export const PODCAST_NAME = 'Hacker News Highlights'

export const podcastOutro = `Thank you for joining us on another episode of the ${PODCAST_NAME}. Have a great day!`
export const podcastOutroWithGitHub = `Thank you for joining us on another episode of the ${PODCAST_NAME}. If you have suggestions to improve the podcast, feel free to leave them on GitHub. Have a great day!`
export const IMPERATIVE_PHRASES = [
  'begin',
  'dive in',
  'dive right in',
  'get going',
  'get into it',
  'get started',
  'jump in',
  'jump right in',
]
