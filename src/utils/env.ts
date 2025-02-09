import path from 'path'
import { loadEnvFile } from 'process'

import { PROJECT_ROOT } from '../lib/constants.js'

export function loadEnvIfExists(absPath?: string) {
  try {
    loadEnvFile(absPath ?? path.resolve(PROJECT_ROOT, '.env'))
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((err as any)?.code !== 'ENOENT') {
      throw err
    }
  }
}
