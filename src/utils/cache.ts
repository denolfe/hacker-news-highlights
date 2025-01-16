import fs from 'fs/promises'
import path from 'path'
import { directoryOrFileExists } from './directoryOrFileExists'

const CACHE_DIR = path.resolve(__dirname, '../../cache')

// File cache to write text to '../../cache' directory
export class Cache {
  private static instance: Cache
  private readonly cacheDir: string
  debug: boolean

  private constructor() {
    this.cacheDir = CACHE_DIR
    this.debug = process.env.DEBUG === 'true'
  }

  static async getInstance(): Promise<Cache> {
    if (!Cache.instance) {
      Cache.instance = new Cache()
      await Cache.initCacheDir()
    }
    return Cache.instance
  }

  private static async initCacheDir() {
    console.log(`[CACHE] Initializing cache directory: ${CACHE_DIR}`)
    if (!(await directoryOrFileExists(CACHE_DIR))) {
      await fs.mkdir(CACHE_DIR)
    }
  }

  async write(key: string, data: string) {
    if (this.debug) {
      console.log(`[CACHE] Writing to cache: ${key}`)
    }
    await fs.writeFile(path.resolve(this.cacheDir, key), data)
  }

  async read(key: string) {
    const location = path.resolve(this.cacheDir, key)
    if (!(await directoryOrFileExists(location))) {
      return null
    }
    if (this.debug) {
      console.log(`[CACHE] Reading from cache: ${key}`)
    }
    return await fs.readFile(location, 'utf-8')
  }
}
