import { describe, expect, test } from 'vitest'

import { toRawGitHubUrl } from './fetchPdfText.js'

describe('toRawGitHubUrl', () => {
  test.each([
    [
      'https://github.com/owner/repo/blob/main/paper.pdf',
      'https://raw.githubusercontent.com/owner/repo/main/paper.pdf',
    ],
    [
      'https://github.com/owner/repo/blob/v1.2/docs/nested/spec.pdf',
      'https://raw.githubusercontent.com/owner/repo/v1.2/docs/nested/spec.pdf',
    ],
  ])('%s', (url, expected) => {
    expect(toRawGitHubUrl(url)).toBe(expected)
  })

  test.each([
    'https://arxiv.org/pdf/2401.00001.pdf',
    'https://raw.githubusercontent.com/owner/repo/main/paper.pdf',
    'https://example.com/owner/repo/blob/main/paper.pdf',
  ])('leaves %s unchanged', url => {
    expect(toRawGitHubUrl(url)).toBe(url)
  })
})
