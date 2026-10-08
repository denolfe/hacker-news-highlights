import { describe, expect, it } from 'vitest'

import type { GateMetrics } from './report.js'

import { pickWinningSetting } from './report.js'

const nano: GateMetrics = {
  columnId: 'nano',
  medianEpisodeSeconds: 800,
  bannedHits: 10,
  formatFailures: 2,
  markdownLeaks: 0,
}

describe('pickWinningSetting', () => {
  it('picks the candidate that passes more ship gates', () => {
    const tooShort: GateMetrics = {
      columnId: 'luna-none',
      medianEpisodeSeconds: 640, // -20%
      bannedHits: 0,
      formatFailures: 0,
      markdownLeaks: 0,
    }
    const passesAll: GateMetrics = {
      columnId: 'luna-low',
      medianEpisodeSeconds: 760, // -5%
      bannedHits: 10,
      formatFailures: 2,
      markdownLeaks: 0,
    }
    expect(pickWinningSetting({ baseline: nano, candidates: [tooShort, passesAll] }).columnId).toBe(
      'luna-low',
    )
  })

  it('breaks a gate tie by the smaller length change from the baseline', () => {
    const minus10: GateMetrics = { ...nano, columnId: 'luna-none', medianEpisodeSeconds: 720 }
    const plus5: GateMetrics = { ...nano, columnId: 'luna-low', medianEpisodeSeconds: 840 }
    expect(pickWinningSetting({ baseline: nano, candidates: [minus10, plus5] }).columnId).toBe(
      'luna-low',
    )
  })
})
