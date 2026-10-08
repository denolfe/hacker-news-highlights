import { describe, expect, it } from 'vitest'

import { LUNA_COLUMNS, priceUsage } from './generate.js'

describe('priceUsage', () => {
  it('prices uncached input, cached input, and output (reasoning included) per 1M tokens', () => {
    const luna = LUNA_COLUMNS[0]
    if (!luna) {
      throw new Error('missing luna column')
    }
    // 800k uncached x $0.20 + 200k cached x $0.02 + 500k output x $1.20
    const cost = priceUsage({
      pricing: luna.pricing,
      usage: {
        inputTokens: 1_000_000,
        cachedInputTokens: 200_000,
        outputTokens: 500_000,
        reasoningTokens: 100_000,
      },
    })
    expect(cost).toBeCloseTo(0.764, 6)
  })
})
