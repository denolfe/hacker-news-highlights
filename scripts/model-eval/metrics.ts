export type SentenceCounts = {
  content: number
  /** Sum across every paragraph after the content paragraph */
  comments: number
}

export function countWords(text: string): number {
  return tokenize(text).length
}

/** Counts sentences in the content paragraph and the comments paragraphs of a story summary. */
export function countSentencesPerParagraph(summary: string): SentenceCounts {
  const [content = '', ...comments] = splitBodyParagraphs(summary)
  return {
    content: countSentences(content),
    comments: comments.reduce((sum, paragraph) => sum + countSentences(paragraph), 0),
  }
}

/** Words the story prompt tells the model to avoid */
export const BANNED_WORDS = [
  'highlight',
  'notable',
  'significant',
  'implications',
  'broader',
  'many',
  'some',
  'several',
  'various',
  'mixed',
  'lively',
  'robust',
  'heated',
  'spirited',
] as const

export type BannedWord = (typeof BANNED_WORDS)[number]

export type BannedWordHits = {
  total: number
  /** Only words with at least one hit */
  byWord: Partial<Record<BannedWord, number>>
}

/** Counts case-insensitive whole-word hits, including -s/-ed/-ing forms ("highlights"). */
export function countBannedWords(text: string): BannedWordHits {
  const byWord: BannedWordHits['byWord'] = {}
  let total = 0
  for (const word of BANNED_WORDS) {
    const count = text.match(new RegExp(`\\b${word}(?:s|ed|ing)?\\b`, 'gi'))?.length ?? 0
    if (count > 0) {
      byWord[word] = count
      total += count
    }
  }
  return { total, byWord }
}

export type FormatFailure =
  | 'content-sentence-count'
  | 'missing-source'
  | 'missing-title'
  | 'source-no-period'
  | 'title-no-period'

/** Checks the story prompt's format rules: plain `Title:`/`Source:` lines ending with a period, 3-5 content sentences. */
export function checkSummaryFormat(summary: string): FormatFailure[] {
  const lines = summary.split('\n').map(line => line.trim())
  const titleLine = lines.find(line => line.startsWith('Title:'))
  const sourceLine = lines.find(line => line.startsWith('Source:'))
  const failures: FormatFailure[] = []

  if (!titleLine) {
    failures.push('missing-title')
  } else if (!titleLine.endsWith('.')) {
    failures.push('title-no-period')
  }
  if (!sourceLine) {
    failures.push('missing-source')
  } else if (!sourceLine.endsWith('.')) {
    failures.push('source-no-period')
  }

  const { content } = countSentencesPerParagraph(summary)
  if (content < 3 || content > 5) {
    failures.push('content-sentence-count')
  }
  return failures
}

export type IntroFormatFailure =
  | 'intro-missing-opener'
  | 'intro-no-period'
  | 'intro-segment-count'
  | 'intro-segment-too-long'

/** Checks the intro prompt's rules: "Today, we dive into a... b... and c." with each summary under 10 words. */
export function checkIntroFormat(intro: string): IntroFormatFailure[] {
  const trimmed = intro.trim()
  const hasOpener = trimmed.startsWith(INTRO_OPENER)
  const body = hasOpener ? trimmed.slice(INTRO_OPENER.length) : trimmed
  const segments = body.split('...').map(segment => segment.trim().replace(/^and\s+/, ''))
  const failures: IntroFormatFailure[] = []

  if (!hasOpener) {
    failures.push('intro-missing-opener')
  }
  if (segments.length !== 3) {
    failures.push('intro-segment-count')
  }
  if (segments.some(segment => countWords(segment) >= MAX_INTRO_SEGMENT_WORDS)) {
    failures.push('intro-segment-too-long')
  }
  if (!trimmed.endsWith('.')) {
    failures.push('intro-no-period')
  }
  return failures
}

const INTRO_OPENER = 'Today, we dive into'
const MAX_INTRO_SEGMENT_WORDS = 10

export type TitleFormatFailure = 'title-extra-punctuation'

/** Checks the title prompt's rule: commas only, no dashes, colons, quotes, parentheses, etc. */
export function checkTitleFormat(title: string): TitleFormatFailure[] {
  return TITLE_BANNED_PUNCTUATION.test(title) ? ['title-extra-punctuation'] : []
}

const TITLE_BANNED_PUNCTUATION = /[—–:;!?"“”()[\]]|\s-\s/

export type MarkdownKind = 'asterisk' | 'backtick' | 'heading' | 'link' | 'list' | 'underscore'

/** Any asterisk, underscore, or backtick counts because the prompt bans those characters outright. */
const MARKDOWN_PATTERNS: Array<{ kind: MarkdownKind; pattern: RegExp }> = [
  { kind: 'asterisk', pattern: /\*/ },
  { kind: 'underscore', pattern: /_/ },
  { kind: 'backtick', pattern: /`/ },
  { kind: 'heading', pattern: /^\s*#{1,6}\s/m },
  { kind: 'list', pattern: /^\s*(?:[-+•]|\d+[.)])\s/m },
  { kind: 'link', pattern: /\[[^\]]+\]\([^)]+\)/ },
]

/** Lists the kinds of markdown found in text; empty means no leakage. */
export function detectMarkdown(text: string): MarkdownKind[] {
  return MARKDOWN_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ kind }) => kind)
}

export type WordFrequencyDiffEntry = {
  word: string
  baselineCount: number
  candidateCount: number
  /** Candidate rate over baseline rate, add-one smoothed so baseline-absent words stay finite */
  ratio: number
}

/** Lists words the candidate outputs use much more often than the baseline outputs, highest ratio first. */
export function diffWordFrequency(params: {
  baseline: string[]
  candidate: string[]
  /** Drops words the candidate uses fewer times than this */
  minCandidateCount?: number
  minRatio?: number
}): WordFrequencyDiffEntry[] {
  const { baseline, candidate, minCandidateCount = 5, minRatio = 2 } = params
  const baselineCounts = countWordFrequency(baseline)
  const candidateCounts = countWordFrequency(candidate)
  const baselineTotal = sumCounts(baselineCounts)
  const candidateTotal = sumCounts(candidateCounts)
  if (baselineTotal === 0 || candidateTotal === 0) {
    return []
  }

  const entries: WordFrequencyDiffEntry[] = []
  for (const [word, candidateCount] of candidateCounts) {
    if (candidateCount < minCandidateCount) {
      continue
    }
    const baselineCount = baselineCounts.get(word) ?? 0
    const ratio = ((candidateCount + 1) * baselineTotal) / ((baselineCount + 1) * candidateTotal)
    if (ratio >= minRatio) {
      entries.push({ word, baselineCount, candidateCount, ratio })
    }
  }
  return entries.sort((a, b) => b.ratio - a.ratio)
}

export type TimedText = {
  text: string
  /** Real audio length of the spoken text */
  durationSeconds: number
}

/** Derives the speaking rate in words per minute, pooled across all samples. */
export function deriveWpm(samples: TimedText[]): number {
  let totalWords = 0
  let totalSeconds = 0
  for (const { text, durationSeconds } of samples) {
    totalWords += countWords(text)
    totalSeconds += durationSeconds
  }
  if (totalSeconds <= 0) {
    throw new Error('Cannot derive WPM: total duration must be greater than zero')
  }
  return (totalWords * 60) / totalSeconds
}

export function estimateAudioSeconds(text: string, wpm: number): number {
  return (countWords(text) * 60) / wpm
}

function countWordFrequency(texts: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const text of texts) {
    for (const token of tokenize(text)) {
      const word = normalizeWord(token)
      if (word) {
        counts.set(word, (counts.get(word) ?? 0) + 1)
      }
    }
  }
  return counts
}

function sumCounts(counts: Map<string, number>): number {
  let total = 0
  for (const count of counts.values()) {
    total += count
  }
  return total
}

/** Lowercases and strips leading/trailing punctuation, keeping inner apostrophes and hyphens. */
function normalizeWord(token: string): string {
  return token.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
}

function splitBodyParagraphs(summary: string): string[] {
  return splitParagraphs(summary).filter(paragraph => !LABEL_LINE.test(paragraph))
}

/** Matches label paragraphs, including markdown-wrapped ones ("**Title:**") */
const LABEL_LINE = /^[*_]*(?:Title|Source):/

/**
 * Splits on terminal punctuation followed by whitespace. Skips single capital letters
 * ("U.S.") and common abbreviations so they do not end a sentence.
 */
function countSentences(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) {
    return 0
  }
  return trimmed
    .split(/(?<!\b(?:[A-Z]|e\.g|i\.e|vs|etc|Mr|Mrs|Ms|Dr))[.!?]+["')\]]*\s+/)
    .filter(Boolean).length
}
