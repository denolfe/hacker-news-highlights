import fs from 'node:fs/promises'
import path from 'node:path'

import { OUTPUT_DIR } from '../../src/constants.js'
import { childLogger } from '../../src/utils/log.js'

/** Gitignored root for artifacts, eval inputs, generations, and the report */
export const EVAL_DIR = path.resolve(OUTPUT_DIR, 'model-eval')

const logger = childLogger('EVAL')

/**
 * Disk-memoizes a JSON value under the eval dir. Separate from the production cache
 * so eval output can never land on a production cache key.
 */
export async function getOrComputeJson<T>(key: string, produce: () => Promise<T>): Promise<T> {
  const filepath = path.resolve(EVAL_DIR, key)
  const cached = await readOptionalFile(filepath)
  if (cached !== undefined) {
    logger.info(`[CACHE] Using cached: ${key}`)
    const value: T = JSON.parse(cached)
    return value
  }
  logger.info(`[CACHE] Miss, computing: ${key}`)
  const value = await produce()
  await fs.mkdir(path.dirname(filepath), { recursive: true })
  await fs.writeFile(filepath, JSON.stringify(value, null, 2))
  return value
}

export async function readOptionalFile(filepath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filepath, 'utf-8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}
