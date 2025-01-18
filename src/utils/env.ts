import { loadEnvFile } from 'process'

export function loadEnvIfExists(absPath: string) {
  try {
    loadEnvFile(absPath)
  } catch (err: unknown) {
    if ((err as any)?.code !== 'ENOENT') {
      // Swallow error if file does not exist
    }
  }
}
