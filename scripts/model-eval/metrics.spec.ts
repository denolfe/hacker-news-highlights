import { describe, expect, it } from 'vitest'

import {
  checkIntroFormat,
  checkSummaryFormat,
  checkTitleFormat,
  countBannedWords,
  countSentencesPerParagraph,
  countWords,
  deriveWpm,
  detectMarkdown,
  diffWordFrequency,
  estimateAudioSeconds,
} from './metrics.js'

const wellFormedSummary = `Title: Rust 1.80 Released.

Source: rust-lang.org.

The post announces version one point eighty of Rust. It adds lazy cells. The U.S. team led the work.

In the comments, the sentiment was largely positive. Users praised the release! Was it overdue? Users debated that.`

describe('countWords', () => {
  it('counts whitespace-separated words, ignoring extra whitespace', () => {
    expect(countWords('  Title: Foo bar.\n\nSource: example.com.  ')).toBe(5)
  })

  it('returns 0 for empty text', () => {
    expect(countWords('   ')).toBe(0)
  })
})

describe('countSentencesPerParagraph', () => {
  it('counts content and comments sentences separately, excluding Title and Source lines', () => {
    expect(countSentencesPerParagraph(wellFormedSummary)).toEqual({ content: 3, comments: 4 })
  })

  it('sums sentences across multiple comments paragraphs', () => {
    const summary = `Title: A.\n\nSource: B.\n\nOne. Two.\n\nIn the comments, users agreed.\n\nOverall it went well. Done.`
    expect(countSentencesPerParagraph(summary)).toEqual({ content: 2, comments: 3 })
  })

  it('returns zeros when there is no body', () => {
    expect(countSentencesPerParagraph('Title: A.\n\nSource: B.')).toEqual({
      content: 0,
      comments: 0,
    })
  })
})

describe('countBannedWords', () => {
  it('counts case-insensitive whole-word hits per banned word', () => {
    const text =
      'Many users noted Several notable points. Some said SOME things; something else was mixed.'
    expect(countBannedWords(text)).toEqual({
      total: 6,
      byWord: { many: 1, several: 1, notable: 1, some: 2, mixed: 1 },
    })
  })

  it('counts inflected forms of banned words', () => {
    expect(countBannedWords('It highlights the implications and was highlighted.')).toEqual({
      total: 3,
      byWord: { highlight: 2, implications: 1 },
    })
  })

  it('returns zero for clean text', () => {
    expect(countBannedWords('Users praised the release.')).toEqual({ total: 0, byWord: {} })
  })
})

describe('diffWordFrequency', () => {
  it('lists words the candidate uses much more than the baseline, ignoring case and punctuation', () => {
    const result = diffWordFrequency({
      baseline: ['The cat sat.', 'the dog sat'],
      candidate: ['The cat Purred.', 'the cat purred'],
      minCandidateCount: 2,
      minRatio: 2,
    })
    // purred: (2+1)/6 vs (0+1)/6 -> 3; cat: (2+1)/6 vs (1+1)/6 -> 1.5, below minRatio
    expect(result).toEqual([{ word: 'purred', baselineCount: 0, candidateCount: 2, ratio: 3 }])
  })

  it('compares rates, not raw counts, when set sizes differ', () => {
    const result = diffWordFrequency({
      baseline: ['alpha beta'],
      candidate: ['alpha alpha gamma gamma'],
      minCandidateCount: 1,
      minRatio: 1.5,
    })
    // gamma: (2+1)/4 vs (0+1)/2 -> 1.5; alpha: (2+1)/4 vs (1+1)/2 -> 0.75
    expect(result).toEqual([{ word: 'gamma', baselineCount: 0, candidateCount: 2, ratio: 1.5 }])
  })

  it('sorts by ratio, highest first', () => {
    const result = diffWordFrequency({
      baseline: ['x y z w'],
      candidate: ['foo foo foo bar bar'],
      minCandidateCount: 1,
      minRatio: 1,
    })
    expect(result.map(entry => entry.word)).toEqual(['foo', 'bar'])
  })
})

describe('checkSummaryFormat', () => {
  it('returns no failures for a well-formed summary', () => {
    expect(checkSummaryFormat(wellFormedSummary)).toEqual([])
  })

  it('flags missing Title and Source lines', () => {
    const summary = 'One. Two. Three.\n\nIn the comments, users agreed.'
    expect(checkSummaryFormat(summary)).toEqual(['missing-title', 'missing-source'])
  })

  it('treats markdown-wrapped labels as missing', () => {
    const summary = '**Title:** Foo.\n\n**Source:** Bar.\n\nOne. Two. Three.'
    expect(checkSummaryFormat(summary)).toEqual(['missing-title', 'missing-source'])
  })

  it('flags Title and Source lines without a trailing period', () => {
    const summary = 'Title: Foo\n\nSource: example.com\n\nOne. Two. Three.'
    expect(checkSummaryFormat(summary)).toEqual(['title-no-period', 'source-no-period'])
  })

  it('flags content outside 3-5 sentences', () => {
    const tooShort = 'Title: Foo.\n\nSource: Bar.\n\nOne. Two.\n\nIn the comments, users agreed.'
    const tooLong =
      'Title: Foo.\n\nSource: Bar.\n\nOne. Two. Three. Four. Five. Six.\n\nIn the comments, users agreed.'
    const atBounds = [
      'Title: Foo.\n\nSource: Bar.\n\nA one. B two. C three.',
      'Title: Foo.\n\nSource: Bar.\n\nOne. Two. Three. Four. Five.',
    ]
    expect(checkSummaryFormat(tooShort)).toEqual(['content-sentence-count'])
    expect(checkSummaryFormat(tooLong)).toEqual(['content-sentence-count'])
    expect(atBounds.map(checkSummaryFormat)).toEqual([[], []])
  })
})

describe('detectMarkdown', () => {
  it('returns nothing for plain prose', () => {
    expect(detectMarkdown(wellFormedSummary)).toEqual([])
  })

  it('ignores literal asterisks and underscores inside names', () => {
    const text =
      'Stars orbit Sagittarius A*, near Earth. The app targets x86_64 Linux and reads foo_bar.'
    expect(detectMarkdown(text)).toEqual([])
  })

  it('reports each kind of markdown found', () => {
    const text = [
      '## Heading',
      '**Title:** Foo.',
      'Uses `code` and _emphasis_ and a [link](https://example.com).',
      '- bullet one',
      '2. numbered',
    ].join('\n')
    expect(detectMarkdown(text)).toEqual([
      'asterisk',
      'underscore',
      'backtick',
      'heading',
      'list',
      'link',
    ])
  })

  it('does not treat hyphenated words or mid-line numbers as lists', () => {
    expect(detectMarkdown('A well-known tool.\nVersion 2. Next sentence - with a dash.')).toEqual(
      [],
    )
  })
})

const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ')

describe('deriveWpm', () => {
  it('pools words and durations across samples', () => {
    // 225 words over 90 seconds -> 150 wpm
    const samples = [
      { text: words(150), durationSeconds: 60 },
      { text: words(75), durationSeconds: 30 },
    ]
    expect(deriveWpm(samples)).toBe(150)
  })

  it('throws when total duration is zero', () => {
    expect(() => deriveWpm([{ text: words(10), durationSeconds: 0 }])).toThrow()
    expect(() => deriveWpm([])).toThrow()
  })
})

describe('estimateAudioSeconds', () => {
  it('converts word count to seconds at the given rate', () => {
    // 300 words at 150 wpm -> 2 minutes
    expect(estimateAudioSeconds(words(300), 150)).toBe(120)
  })
})

describe('checkIntroFormat', () => {
  it('passes the "Today, we dive into a... b... and c." shape with short segments', () => {
    expect(
      checkIntroFormat(
        'Today, we dive into Mistral Large 4 pushing open AI... releasing EmbeddingGemma 2... and sharing math progress.',
      ),
    ).toEqual([])
  })

  it('flags a missing opener, wrong segment count, long segment, and missing period', () => {
    expect(
      checkIntroFormat('We look at one two three four five six seven eight nine ten... and eleven'),
    ).toEqual([
      'intro-missing-opener',
      'intro-segment-count',
      'intro-segment-too-long',
      'intro-no-period',
    ])
  })
})

describe('checkTitleFormat', () => {
  it('passes a single comma-separated sentence, allowing hyphens, apostrophes, and version dots', () => {
    expect(checkTitleFormat("Mistral Large 4.1, open-weight AI, GitHub's takedowns")).toEqual([])
  })

  it('flags punctuation the title prompt bans', () => {
    expect(checkTitleFormat('Mistral Large 4: open AI — "fast" (beta)')).toEqual([
      'title-extra-punctuation',
    ])
  })
})
