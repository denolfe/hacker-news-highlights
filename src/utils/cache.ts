import { CACHE_DIR } from '@/constants.js'
import fs from 'fs/promises'
import path from 'path'

import { directoryOrFileExists } from './directoryOrFileExists.js'
import { log } from './log.js'

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

export async function cacheExists(key: string): Promise<boolean> {
  const location = path.resolve(CACHE_DIR, key)
  return await directoryOrFileExists(location)
}

/**
 * Disk-memoize a text/JSON value: return the cached string on a hit, otherwise
 * run the producer, persist its result, and return it. The producer only runs
 * on a miss and nothing is written when it throws.
 */
export async function getOrCompute(key: string, produce: () => Promise<string>): Promise<string> {
  const cached = await readFromCache(key)
  if (cached !== null) {
    log.info(`[CACHE] Using cached: ${key}`)
    return cached
  }
  const value = await produce()
  await writeToCache(key, value)
  return value
}

/**
 * Disk-memoize a file: return the resolved cache filepath on a hit, otherwise
 * hand the producer that filepath to write to and return it. Owns the
 * `CACHE_DIR` path so callers never build it themselves.
 */
export async function getOrComputeFile(
  key: string,
  produce: (filepath: string) => Promise<void>,
): Promise<string> {
  const filepath = path.resolve(CACHE_DIR, key)
  if (await cacheExists(key)) {
    log.info(`[CACHE] Using cached: ${key}`)
    return filepath
  }
  await produce(filepath)
  return filepath
}
