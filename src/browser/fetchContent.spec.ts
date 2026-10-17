import { describe, expect, test } from 'vitest'

import { isBotChallengeText } from './fetchContent.js'

describe('isBotChallengeText', () => {
  test('detects an Akamai access denied page', () => {
    const text =
      'Access Denied\nYou don\'t have permission to access "http://www.tesla.com/roadster" on this server.\nReference #18.aff7d517.1792230131.219e7aed'
    expect(isBotChallengeText(text)).toBe(true)
  })

  test('detects a page with too little text', () => {
    expect(isBotChallengeText('Loading')).toBe(true)
  })

  test('accepts a long article that mentions a challenge keyword', () => {
    const text = `${'The server returned access denied for the admin route. '.repeat(10)}${'Body text. '.repeat(300)}`
    expect(isBotChallengeText(text)).toBe(false)
  })
})
