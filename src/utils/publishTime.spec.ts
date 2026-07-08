import { describe, expect, it } from 'vitest'

import { getScheduledPublishTime } from '@/utils/publishTime.js'

describe('getScheduledPublishTime', () => {
  it('returns 10:30 UTC in summer (6:30am EDT)', () => {
    const result = getScheduledPublishTime(new Date('2026-07-15T05:47:00Z'))
    expect(result.toISOString()).toBe('2026-07-15T10:30:00.000Z')
  })

  it('returns 11:30 UTC in winter (6:30am EST)', () => {
    const result = getScheduledPublishTime(new Date('2026-01-15T05:47:00Z'))
    expect(result.toISOString()).toBe('2026-01-15T11:30:00.000Z')
  })

  it('handles the spring-forward day (2026-03-08, 2am skips to 3am)', () => {
    // 05:47 UTC = 12:47am EST; 6:30am that morning is already EDT
    const result = getScheduledPublishTime(new Date('2026-03-08T05:47:00Z'))
    expect(result.toISOString()).toBe('2026-03-08T10:30:00.000Z')
  })

  it('handles the fall-back day (2026-11-01, 2am repeats to 1am)', () => {
    // 05:47 UTC = 1:47am EDT; 6:30am that morning is EST
    const result = getScheduledPublishTime(new Date('2026-11-01T05:47:00Z'))
    expect(result.toISOString()).toBe('2026-11-01T11:30:00.000Z')
  })

  it('is in the future relative to an early-morning cron firing', () => {
    const now = new Date('2026-07-15T05:47:00Z')
    expect(getScheduledPublishTime(now).getTime()).toBeGreaterThan(now.getTime())
  })
})
