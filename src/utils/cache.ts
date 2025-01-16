import fs from 'fs/promises'
import path from 'path'
import { directoryOrFileExists } from './directoryOrFileExists'

const CACHE_DIR = path.resolve(__dirname, '../../cache')
const debug = process.env.DEBUG === 'true'

export async function initCacheDir() {
  console.log(`[CACHE] Initializing cache directory: ${CACHE_DIR}`)
  if (!(await directoryOrFileExists(CACHE_DIR))) {
    await fs.mkdir(CACHE_DIR)
  }
}

export async function writeToCache(key: string, data: string) {
  if (debug) {
    console.log(`[CACHE] Writing to cache: ${key}`)
  }
  await fs.writeFile(path.resolve(CACHE_DIR, key), data)
}

export async function readFromCache(key: string) {
  const location = path.resolve(CACHE_DIR, key)
  if (!(await directoryOrFileExists(location))) {
    return null
  }
  if (debug) {
    console.log(`[CACHE] Reading from cache: ${key}`)
  }
  return await fs.readFile(location, 'utf-8')
}
