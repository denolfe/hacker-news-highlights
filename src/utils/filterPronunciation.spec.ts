import { describe, test, expect } from 'vitest'
import { filterPronunciation } from './filterPronunciation'

describe('filterPronunciation', () => {
  test('replaces hyphens in source line', () => {
    const input = 'Source: maxima-on-something.pages.dev'
    const expected = 'Source: maxima on something.pages.dev'
    expect(filterPronunciation(input)).toBe(expected)
  })

  // Simple word replacements
  test.each([
    ['gzip', 'jee-zip'],
    ['GZIP', 'jee-zip'],
    ['wasm', 'wah-zum'],
    ['WASM', 'wah-zum'],
    ['sqlite', 'ess-cue-lite'],
    ['SQLITE', 'ess-cue-lite'],
    ['gui', 'gooey'],
    ['GUI', 'gooey'],
    ['rowid', 'row ID'],
    ['ROWID', 'row ID'],
  ])('replaces %s with %s', (input, expected) => {
    expect(filterPronunciation(input)).toBe(expected)
  })

  // Special character removal
  test.each([
    ['•', ''],
    ['|', ''],
  ])(`removes special character: %s`, (input, expected) => {
    expect(filterPronunciation(input)).toBe(expected)
  })
})
