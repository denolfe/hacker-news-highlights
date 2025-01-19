import { vi } from 'vitest'

import * as cache from './utils/cache'

export const jsonResponse = (data: any) =>
  Promise.resolve({
    headers: new Headers({ 'content-type': 'application/json' }),
    ok: true,
    json: () => Promise.resolve(data),
  })

export const textResponse = (text: string) =>
  Promise.resolve({
    headers: new Headers({ 'content-type': 'application/text' }),
    ok: true,
    text: () => Promise.resolve(text),
  })

export const disableCache = () => {
  vi.spyOn(cache, 'readFromCache').mockResolvedValue(null)
  vi.spyOn(cache, 'writeToCache').mockResolvedValue()
}
