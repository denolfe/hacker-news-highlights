import fs from 'fs/promises'
import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getOrCompute, getOrComputeFile } from './cache.js'
import { directoryOrFileExists } from './directoryOrFileExists.js'

vi.mock('fs/promises', () => ({
  default: { readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn() },
}))
vi.mock('./directoryOrFileExists.js', () => ({
  directoryOrFileExists: vi.fn(),
}))

const mockExists = vi.mocked(directoryOrFileExists)
const mockFs = vi.mocked(fs)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getOrCompute', () => {
  it('returns the cached value without invoking the producer on a hit', async () => {
    mockExists.mockResolvedValue(true)
    mockFs.readFile.mockResolvedValue('cached-value')
    const produce = vi.fn()

    const result = await getOrCompute('summary-1', produce)

    expect(result).toBe('cached-value')
    expect(produce).not.toHaveBeenCalled()
    expect(mockFs.writeFile).not.toHaveBeenCalled()
  })

  it('computes, writes, and returns the value on a miss', async () => {
    mockExists.mockResolvedValue(false)
    const produce = vi.fn().mockResolvedValue('fresh-value')

    const result = await getOrCompute('summary-1', produce)

    expect(result).toBe('fresh-value')
    expect(produce).toHaveBeenCalledOnce()
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('summary-1'),
      'fresh-value',
    )
  })

  it('does not write to cache when the producer throws', async () => {
    mockExists.mockResolvedValue(false)
    const produce = vi.fn().mockRejectedValue(new Error('boom'))

    await expect(getOrCompute('summary-1', produce)).rejects.toThrow('boom')
    expect(mockFs.writeFile).not.toHaveBeenCalled()
  })
})

describe('getOrComputeFile', () => {
  it('returns the resolved filepath without invoking the producer on a hit', async () => {
    mockExists.mockResolvedValue(true)
    const produce = vi.fn()

    const result = await getOrComputeFile('screenshot-1.png', produce)

    expect(result).toContain('screenshot-1.png')
    expect(path.isAbsolute(result)).toBe(true)
    expect(produce).not.toHaveBeenCalled()
  })

  it('hands the producer the resolved filepath on a miss and returns it', async () => {
    mockExists.mockResolvedValue(false)
    const produce = vi.fn().mockResolvedValue(undefined)

    const result = await getOrComputeFile('screenshot-1.png', produce)

    expect(produce).toHaveBeenCalledWith(result)
    expect(result).toContain('screenshot-1.png')
    expect(path.isAbsolute(result)).toBe(true)
  })
})
