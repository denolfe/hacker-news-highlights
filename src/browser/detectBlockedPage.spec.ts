import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

import { detectBlockedPage } from './detectBlockedPage.js'

describe('detectBlockedPage', () => {
  test('flags an Akamai access denied page by status', () => {
    const html = readPageFixture('akamai-access-denied.html')
    expect(checkPage({ status: 403, headers: {}, html })).toEqual({
      reason: 'blocked',
      detail: 'HTTP 403',
    })
  })

  test('flags a Cloudflare challenge by the cf-mitigated header', () => {
    const headers = { 'cf-mitigated': 'challenge' }
    expect(checkPage({ status: 200, headers, html: '' })).toEqual({
      reason: 'blocked',
      detail: 'cf-mitigated header',
    })
  })

  test('flags a Cloudflare challenge page by its markup', () => {
    const html = readPageFixture('cloudflare-challenge.html')
    expect(checkPage({ status: 200, headers: {}, html })?.reason).toBe('blocked')
  })

  test('flags an Anubis challenge served with status 200', () => {
    const html = readPageFixture('anubis-challenge.html')
    expect(checkPage({ status: 200, headers: {}, html })).toEqual({
      reason: 'blocked',
      detail: 'Anubis challenge',
    })
  })

  test('flags an AWS WAF challenge served with status 202', () => {
    const headers = { 'x-amzn-waf-action': 'challenge' }
    expect(checkPage({ status: 202, headers, html: '' })).toEqual({
      reason: 'blocked',
      detail: 'AWS WAF challenge',
    })
  })

  test('reports other error statuses as HTTP errors', () => {
    expect(checkPage({ status: 404, headers: {}, html: '' })).toEqual({
      reason: 'http-error',
      detail: 'HTTP 404',
    })
  })

  test('reports an article that redirects to the homepage as a soft 404', () => {
    const finalUrl = 'https://example.com/?err=404'
    expect(checkPage({ status: 200, headers: {}, html: '', finalUrl })).toEqual({
      reason: 'http-error',
      detail: 'redirected to homepage',
    })
  })

  test('accepts a story link to a homepage', () => {
    const homepage = 'https://example.com/'
    expect(
      checkPage({ status: 200, headers: {}, html: '', requestedUrl: homepage, finalUrl: homepage }),
    ).toBeNull()
  })

  test('accepts a response with no final URL', () => {
    expect(checkPage({ status: 200, headers: {}, html: '', finalUrl: '' })).toBeNull()
  })

  test('accepts a normal page that loads the Cloudflare bot detection script', () => {
    const html = readPageFixture('cloudflare-normal-page.html')
    expect(checkPage({ status: 200, headers: {}, html })).toBeNull()
  })
})

const ARTICLE_URL = 'https://example.com/2026/10/article'

/** Checks a page that stayed at the article URL unless the test sets other URLs */
function checkPage(
  params: Omit<Parameters<typeof detectBlockedPage>[0], 'finalUrl' | 'requestedUrl'> &
    Partial<Pick<Parameters<typeof detectBlockedPage>[0], 'finalUrl' | 'requestedUrl'>>,
) {
  return detectBlockedPage({ requestedUrl: ARTICLE_URL, finalUrl: ARTICLE_URL, ...params })
}

function readPageFixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/pages/${name}`, import.meta.url), 'utf8')
}
