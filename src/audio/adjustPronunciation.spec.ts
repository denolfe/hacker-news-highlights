import { describe, test, expect } from 'vitest'
import { filterPronunciation } from './adjustPronunciation.js'

describe('filterPronunciation', () => {
  test('replaces hyphens in source line', () => {
    const input = 'Source: maxima-on-something.pages.dev'
    const expected = 'Source: maxima on something.pages.dev'
    expect(filterPronunciation(input)).toBe(expected)
  })

  // Simple word replacements
  test.each([
    ['gui', 'gooey'],
    ['gzip', 'jee-zip'],
    ['postgresql', 'post-gress-cue-ell'],
    ['rowid', 'row ID'],
    ['sql', 'sequel'],
    ['sqlite', 'ess-cue-lite'],
    ['wasm', 'wazum'],
    ['memecoin', 'meme-coin'],
    ['vram', 'vee-ram'],
    ['codegen', 'code-gen'],
    ['bluesky', 'blue-sky'],
    ['gnu', 'guh-new'],
    ['next.js', 'next-jay-ess'],
  ])('replaces %s with %s', (input, expected) => {
    expect(filterPronunciation(input)).toBe(expected)
    expect(filterPronunciation(input.toUpperCase())).toBe(expected)
  })

  // Special character removal
  test.each([
    ['•', ''],
    ['|', ''],
  ])(`removes special character: %s`, (input, expected) => {
    expect(filterPronunciation(input)).toBe(expected)
  })
})
