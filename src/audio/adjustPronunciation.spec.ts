import { describe, test, expect } from 'vitest'
import { adjustPronunciation } from './adjustPronunciation.js'

describe('adjustPronunciation', () => {
  test('replaces hyphens in source line', () => {
    const input = 'Source: maxima-on-something.pages.dev'
    const expected = 'Source: maxima on something.pages.dev'
    expect(adjustPronunciation(input)).toBe(expected)
  })

  test('replaces nytimes.com with The New York Times', () => {
    const input = 'Source: nytimes.com'
    const expected = 'Source: The New York Times'
    expect(adjustPronunciation(input)).toBe(expected)
  })

  // Simple word replacements
  test.each([
    ['gui', 'gooey'],
    ['gzip', 'jee-zip'],
    ['postgresql', 'postgress QL'],
    ['rowid', 'row ID'],
    ['sql', 'sequel'],
    ['sqlite', 'SQ-lite'],
    ['wasm', 'wazum'],
    ['memecoin', 'meme-coin'],
    ['vram', 'vee-ram'],
    ['codegen', 'code-gen'],
    ['bluesky', 'blue-sky'],
    ['gnu', 'guh-new'],
    ['ffmpeg', 'eff-eff-empeg'],
    ['c#', 'C-Sharp'],
    ['f#', 'F-Sharp'],
    ['redis', 'red-iss'],
    ['systemd', 'system D'],
    ['nas', 'nazz'],
    ['freenas', 'freenazz'],
    ['nginx', 'engine-X'],
    ['ocaml', 'O-Camel'],
    ['wysiwyg', 'wizzy-wig'],
    ['ascii', 'askee'],
    ['monorepo', 'mono-ree-poh'],
  ])('replaces %s with %s', (input, expected) => {
    expect(adjustPronunciation(input)).toBe(expected)
    expect(adjustPronunciation(input.toUpperCase())).toBe(expected)
  })

  // Words containing '.' and followed by a comma
  test.each([
    ['Johnny.Decimal,', 'Johnny-Decimal,'],
    ['somedomain.com,', 'somedomain-dot-com,'],
    ['somedomain.org,', 'somedomain-dot-org,'],
    ['noperiod,', 'noperiod,'],
  ])(
    'words that contain "." and followed by comma should replace with hyphen: %s',
    (input, expected) => {
      expect(adjustPronunciation(input)).toBe(expected)
    },
  )

  // Special character removal
  test.each([
    ['•', ''],
    ['|', ''],
  ])(`removes special character: %s`, (input, expected) => {
    expect(adjustPronunciation(input)).toBe(expected)
  })

  test.each([
    ["U.S.'s", "U-S's"],
    ["U.S.A.'s", "U-S-A's"],
    ['U.S.,', 'U-S,'],
    ['U.S.A.,', 'U-S-A,'],
  ])(`replaces "." with "-": %s`, (input, expected) => {
    expect(adjustPronunciation(input)).toBe(expected)
  })

  test.each([
    ['Next.js', 'Next JS'],
    ['PDF.js', 'PDF JS'],
  ])('replaces .js suffix with pronouncable: %s', (input, expected) => {
    expect(adjustPronunciation(input)).toBe(expected)
  })

  test.each([['itter.sh', 'itter dot SH']])(
    'replace .sh suffix with pronouncable: %s',
    (input, expected) => {
      expect(adjustPronunciation(input)).toBe(expected)
    },
  )

  test.each([
    ['OpenAI', 'Open AI'],
    ['FastVLM', 'Fast VLM'],
    ['row ID', 'row ID'], // no change
  ])('inserts space in words that end with an acronym: %s', (input, expected) => {
    expect(adjustPronunciation(input)).toBe(expected)
  })

  test.each([
    ['gpt-5.2', 'gpt-5-point-2'], // case insensitive
    ['v1.2', 'v1-point-2'],
    ['Python 3.9', 'Python 3-point-9'],
    ['Node.js 20.5', 'Node JS 20-point-5'], // combines with .js pattern
    ['React 18.2', 'React 18-point-2'],
    ['Ruby 4.0.0', 'Ruby 4-point-0-point-0'],
    ['version 2.0', 'version 2-point-0'],
  ])('converts version numbers to use "-point-": %s', (input, expected) => {
    expect(adjustPronunciation(input)).toBe(expected)
  })
})
