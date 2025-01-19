import path from 'path'
import { loadEnvFile } from 'process'

import { PROJECT_ROOT } from '../lib/constants'

export function loadEnvIfExists(absPath?: string) {
  try {
    loadEnvFile(absPath ?? path.resolve(PROJECT_ROOT, '.env'))
  } catch (err: unknown) {
    if ((err as any)?.code !== 'ENOENT') {
      // Swallow error if file does not exist
    }
  }
}
