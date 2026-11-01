import { childLogger } from '@/utils/log.js'

const logger = childLogger('HN')
const BASE_BACKOFF_MS = 2000

/**
 * Fetches a URL, aborting each attempt after `timeoutMs` and retrying failures with exponential backoff.
 * Defaults ride out about 2 minutes of API trouble: 6 x 10s attempts plus 2+4+8+16+32s of backoff.
 * Backoff matters most for fast 429/5xx responses, which would otherwise exhaust every attempt in under a second.
 */
export async function fetchWithRetry(
  url: string,
  {
    timeoutMs = 10_000,
    attempts = 6,
    shouldRetryHttpErrors = true,
  }: { timeoutMs?: number; attempts?: number; shouldRetryHttpErrors?: boolean } = {},
): Promise<Response> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(id)
      if (shouldRetryHttpErrors && isRetryableStatus(response.status)) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response
    } catch (error: unknown) {
      clearTimeout(id)
      if (attempt === attempts) {
        logger.error(
          `Failed to fetch ${url} after ${attempts} attempts: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        )
        logger.error(error)
        throw error
      }
      const backoffMs = BASE_BACKOFF_MS * 2 ** (attempt - 1)
      logger.warning(
        `Attempt ${attempt} failed for ${url}. ${error instanceof Error ? error.message : JSON.stringify(error)}. Retrying in ${backoffMs}ms`,
      )
      await new Promise(resolve => setTimeout(resolve, backoffMs))
    }
  }
  throw new Error(`Failed to fetch ${url} after ${attempts} attempts`)
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}
