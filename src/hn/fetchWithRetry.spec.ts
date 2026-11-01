import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { fetchWithRetry } from './fetchWithRetry.js'

const URL = 'https://hn.algolia.com/api/v1/items/1'

/** Mimics a server that never responds: the request only settles when aborted. */
function hangUntilAborted(_url: string, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })
}

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  test('waits with exponential backoff between attempts', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    global.fetch = fetchMock

    const result = fetchWithRetry(URL, { attempts: 4 }).catch(() => undefined)

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(4000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(8000)
    expect(fetchMock).toHaveBeenCalledTimes(4)

    await result
  })

  test('survives a server that hangs for 5 attempts', async () => {
    const fetchMock = vi.fn()
    for (let i = 0; i < 5; i++) {
      fetchMock.mockImplementationOnce(hangUntilAborted)
    }
    fetchMock.mockResolvedValueOnce(new Response('ok'))
    global.fetch = fetchMock

    const result = fetchWithRetry(URL)
    await vi.runAllTimersAsync()

    await expect((await result).text()).resolves.toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  test.each([429, 500, 502, 503, 504])('retries HTTP %i responses', async status => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status }))
      .mockResolvedValueOnce(new Response('ok'))
    global.fetch = fetchMock

    const result = fetchWithRetry(URL)
    await vi.runAllTimersAsync()

    await expect((await result).text()).resolves.toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('returns HTTP 404 responses without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('missing', { status: 404 }))
    global.fetch = fetchMock

    const response = await fetchWithRetry(URL)

    expect(response.status).toBe(404)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('returns HTTP error responses as-is when shouldRetryHttpErrors is false', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('blocked', { status: 503 }))
    global.fetch = fetchMock

    const response = await fetchWithRetry(URL, { shouldRetryHttpErrors: false })

    expect(response.status).toBe(503)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('throws the HTTP status once attempts are exhausted', async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response('busy', { status: 503 })))

    const result = fetchWithRetry(URL, { attempts: 2 })
    const assertion = expect(result).rejects.toThrow('HTTP 503')
    await vi.runAllTimersAsync()

    await assertion
  })

  test('throws the last error once attempts are exhausted', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'))

    const result = fetchWithRetry(URL, { attempts: 2 })
    const assertion = expect(result).rejects.toThrow('network down')
    await vi.runAllTimersAsync()

    await assertion
  })
})
