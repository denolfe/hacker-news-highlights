import fs from 'fs/promises'
import path from 'path'

import { CACHE_DIR } from '../lib/constants'
import { directoryOrFileExists } from './directoryOrFileExists'
import { log } from './log'

const debug = process.env.DEBUG === 'true'

export async function initCacheDir() {
  log.debug(`[CACHE] Initializing cache directory: ${CACHE_DIR}`)
  if (!(await directoryOrFileExists(CACHE_DIR))) {
    await fs.mkdir(CACHE_DIR)
  }
}

export async function writeToCache(key: string, data: Buffer<ArrayBufferLike> | string) {
  if (debug) {
    log.debug(`[CACHE] Writing to cache: ${key}`)
  }
  await fs.writeFile(path.resolve(CACHE_DIR, key), data)
}

export async function readFromCache(key: string) {
  const location = path.resolve(CACHE_DIR, key)
  if (!(await directoryOrFileExists(location))) {
    return null
  }
  if (debug) {
    log.debug(`[CACHE] Reading from cache: ${key}`)
  }
  return await fs.readFile(location, 'utf-8')
}
