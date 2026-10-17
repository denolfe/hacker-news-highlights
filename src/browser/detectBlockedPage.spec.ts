import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

import { detectBlockedPage } from './detectBlockedPage.js'

describe('detectBlockedPage', () => {
  test('flags an Akamai access denied page by status', () => {
    const html = readPageFixture('akamai-access-denied.html')
    expect(detectBlockedPage({ status: 403, headers: {}, html })).toEqual({
      reason: 'blocked',
      detail: 'HTTP 403',
    })
  })

  test('flags a Cloudflare challenge by the cf-mitigated header', () => {
    const headers = { 'cf-mitigated': 'challenge' }
    expect(detectBlockedPage({ status: 200, headers, html: '' })).toEqual({
      reason: 'blocked',
      detail: 'cf-mitigated header',
    })
  })

  test('flags a Cloudflare challenge page by its markup', () => {
    const html = readPageFixture('cloudflare-challenge.html')
    expect(detectBlockedPage({ status: 200, headers: {}, html })?.reason).toBe('blocked')
  })

  test('flags an Anubis challenge served with status 200', () => {
    const html = readPageFixture('anubis-challenge.html')
    expect(detectBlockedPage({ status: 200, headers: {}, html })).toEqual({
      reason: 'blocked',
      detail: 'Anubis challenge',
    })
  })

  test('flags an AWS WAF challenge served with status 202', () => {
    const headers = { 'x-amzn-waf-action': 'challenge' }
    expect(detectBlockedPage({ status: 202, headers, html: '' })).toEqual({
      reason: 'blocked',
      detail: 'AWS WAF challenge',
    })
  })

  test('reports other error statuses as HTTP errors', () => {
    expect(detectBlockedPage({ status: 404, headers: {}, html: '' })).toEqual({
      reason: 'http-error',
      detail: 'HTTP 404',
    })
  })

  test('accepts a normal page that loads the Cloudflare bot detection script', () => {
    const html = readPageFixture('cloudflare-normal-page.html')
    expect(detectBlockedPage({ status: 200, headers: {}, html })).toBeNull()
  })
})

function readPageFixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/pages/${name}`, import.meta.url), 'utf8')
}
