import { describe, expect, it } from 'vitest'

import { getEpisodeDatePrefix } from '@/utils/episodeDate.js'

describe('getEpisodeDatePrefix', () => {
  it('formats as M.D.YY without zero padding', () => {
    expect(getEpisodeDatePrefix(new Date('2026-08-30T14:00:00.000Z'))).toBe('8.30.26')
  })

  it('uses the Eastern calendar day, not UTC', () => {
    // 01:30 UTC on Aug 31 is still Aug 30 in New York
    expect(getEpisodeDatePrefix(new Date('2026-08-31T01:30:00.000Z'))).toBe('8.30.26')
  })

  it('is stable across a run that spans the UTC-morning window', () => {
    const early = getEpisodeDatePrefix(new Date('2026-08-30T05:47:00.000Z'))
    const late = getEpisodeDatePrefix(new Date('2026-08-30T11:49:00.000Z'))
    expect(early).toBe(late)
  })
})
