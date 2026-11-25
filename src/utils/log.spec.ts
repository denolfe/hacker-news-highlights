import { afterEach, describe, expect, it, vi } from 'vitest'

import { isDebug } from '@/utils/log.js'

describe('isDebug', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is true when DEBUG is "true"', () => {
    vi.stubEnv('DEBUG', 'true')
    expect(isDebug()).toBe(true)
  })

  // Workflow dispatch passes the unchecked boolean input as the string "false"
  it('is false when DEBUG is "false"', () => {
    vi.stubEnv('DEBUG', 'false')
    expect(isDebug()).toBe(false)
  })

  it('is false when DEBUG is empty', () => {
    vi.stubEnv('DEBUG', '')
    expect(isDebug()).toBe(false)
  })
})
