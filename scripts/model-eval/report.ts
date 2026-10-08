import type { TokenUsage } from './generate.js'

import {
  checkSummaryFormat,
  countBannedWords,
  countSentencesPerParagraph,
  countWords,
  detectMarkdown,
  diffWordFrequency,
  estimateAudioSeconds,
} from './metrics.js'

export type ReportColumn = {
  id: string
  label: string
  /** Absent for the CI column, which has no token data */
  usage?: TokenUsage
  costUsd?: number
}

export type EvaluatedStory = {
  /** Episode date, YYYY-MM-DD */
  date: string
  /** 1-based position in the episode */
  rank: number
  storyId: number
  title: string
  /** Summary text keyed by column id */
  texts: Record<string, string>
}

export type SkippedStory = {
  date: string
  storyId: number
  title: string
  reason: string
}

/** Column numbers the spec's ship gates compare against the baseline */
export type GateMetrics = {
  columnId: string
  medianEpisodeSeconds: number
  bannedHits: number
  formatFailures: number
  markdownLeaks: number
}

/** Renders the eval report: aggregate table and frequency diff on top, per-story side-by-side below. */
export function renderReport(params: {
  baseline: ReportColumn
  candidates: ReportColumn[]
  ci: ReportColumn
  skipped: SkippedStory[]
  stories: EvaluatedStory[]
  /** Words per minute derived from CI summaries and real chapter durations */
  wpm: number
}): string {
  const { baseline, candidates, ci, skipped, stories, wpm } = params
  const columns = [ci, baseline, ...candidates]
  const aggregates = new Map(
    columns.map(column => [column.id, aggregateColumn({ columnId: column.id, stories, wpm })]),
  )
  const baselineAggregate = getOrThrow(aggregates, baseline.id)
  const candidateAggregates = candidates.map(column => getOrThrow(aggregates, column.id))
  const winner = pickWinningSetting({
    baseline: baselineAggregate,
    candidates: candidateAggregates,
  })
  const winnerColumn = getOrThrow(new Map(candidates.map(c => [c.id, c])), winner.columnId)
  const sideBySide = [ci, baseline, winnerColumn]
  const episodeCount = new Set(stories.map(story => story.date)).size

  return [
    '# Summary Model Eval',
    '',
    `${stories.length} stories across ${episodeCount} episodes. Baseline: ${baseline.label}. Audio estimates use ${wpm.toFixed(1)} WPM, derived from CI summaries against real chapter durations.`,
    '',
    '## Aggregate',
    '',
    renderAggregateTable({ aggregates, baseline: baselineAggregate, columns }),
    '',
    renderGates({ baseline: baselineAggregate, candidates, aggregates }),
    '',
    `Side-by-side setting: **${winnerColumn.label}** (passes the most gates; ties go to the smaller length change).`,
    '',
    ...candidates.flatMap(candidate => [
      `## Words ${candidate.label} uses much more than ${baseline.label}`,
      '',
      renderFrequencyDiff({ baseline, candidate, stories }),
      '',
    ]),
    renderSkipped(skipped),
    '',
    '## Stories',
    '',
    ...stories.flatMap(story => [renderStory({ columns: sideBySide, story, wpm }), '']),
  ].join('\n')
}

/**
 * Picks the candidate that passes the most ship gates against the baseline
 * (length within 15%, banned words and format failures no worse, zero markdown).
 * Ties go to the smaller length change.
 */
export function pickWinningSetting<T extends GateMetrics>(params: {
  baseline: GateMetrics
  candidates: T[]
}): T {
  const { baseline, candidates } = params
  const ranked = candidates
    .map(candidate => ({
      candidate,
      gatesPassed: evaluateGates({ baseline, candidate }).filter(gate => gate.isPassed).length,
      lengthChange: Math.abs(lengthChangeRatio({ baseline, candidate })),
    }))
    .sort((a, b) => b.gatesPassed - a.gatesPassed || a.lengthChange - b.lengthChange)
  const winner = ranked[0]
  if (!winner) {
    throw new Error('Cannot pick a winning setting from zero candidates')
  }
  return winner.candidate
}

const MAX_LENGTH_CHANGE = 0.15

type ColumnAggregate = {
  medianWords: number
} & GateMetrics

function aggregateColumn(params: {
  columnId: string
  stories: EvaluatedStory[]
  wpm: number
}): ColumnAggregate {
  const { columnId, stories, wpm } = params
  const texts = stories.map(story => story.texts[columnId] ?? '')
  const secondsByEpisode = new Map<string, number>()
  for (const story of stories) {
    const seconds = estimateAudioSeconds(story.texts[columnId] ?? '', wpm)
    secondsByEpisode.set(story.date, (secondsByEpisode.get(story.date) ?? 0) + seconds)
  }
  return {
    columnId,
    medianEpisodeSeconds: median([...secondsByEpisode.values()]),
    medianWords: median(texts.map(countWords)),
    bannedHits: sum(texts.map(text => countBannedWords(text).total)),
    formatFailures: sum(texts.map(text => checkSummaryFormat(text).length)),
    markdownLeaks: texts.filter(text => detectMarkdown(text).length > 0).length,
  }
}

function lengthChangeRatio(params: { baseline: GateMetrics; candidate: GateMetrics }): number {
  const { baseline, candidate } = params
  return (
    (candidate.medianEpisodeSeconds - baseline.medianEpisodeSeconds) / baseline.medianEpisodeSeconds
  )
}

function evaluateGates(params: {
  baseline: GateMetrics
  candidate: GateMetrics
}): Array<{ isPassed: boolean; name: string }> {
  const { baseline, candidate } = params
  return [
    {
      name: 'length within 15%',
      isPassed: Math.abs(lengthChangeRatio(params)) <= MAX_LENGTH_CHANGE,
    },
    { name: 'banned words <= baseline', isPassed: candidate.bannedHits <= baseline.bannedHits },
    {
      name: 'format failures <= baseline',
      isPassed: candidate.formatFailures <= baseline.formatFailures,
    },
    { name: 'zero markdown', isPassed: candidate.markdownLeaks === 0 },
  ]
}

function renderAggregateTable(params: {
  aggregates: Map<string, ColumnAggregate>
  baseline: ColumnAggregate
  columns: ReportColumn[]
}): string {
  const { aggregates, baseline, columns } = params
  const rows = columns.map(column => {
    const aggregate = getOrThrow(aggregates, column.id)
    const change = lengthChangeRatio({ baseline, candidate: aggregate })
    const { usage } = column
    return [
      column.label,
      formatDuration(aggregate.medianEpisodeSeconds),
      formatPercent(change),
      String(aggregate.medianWords),
      String(aggregate.bannedHits),
      String(aggregate.formatFailures),
      String(aggregate.markdownLeaks),
      usage ? `${usage.inputTokens} (${usage.cachedInputTokens})` : 'n/a',
      usage ? String(usage.outputTokens) : 'n/a',
      usage ? String(usage.reasoningTokens) : 'n/a',
      column.costUsd === undefined ? 'n/a' : `$${column.costUsd.toFixed(4)}`,
    ]
  })
  return renderTable({
    header: [
      'Column',
      'Median episode audio',
      'vs baseline',
      'Median words',
      'Banned hits',
      'Format failures',
      'Markdown leaks',
      'Input tok (cached)',
      'Output tok',
      'Reasoning tok',
      'Cost',
    ],
    rows,
  })
}

function renderGates(params: {
  aggregates: Map<string, ColumnAggregate>
  baseline: ColumnAggregate
  candidates: ReportColumn[]
}): string {
  const { aggregates, baseline, candidates } = params
  return candidates
    .map(column => {
      const gates = evaluateGates({ baseline, candidate: getOrThrow(aggregates, column.id) })
      const summary = gates
        .map(gate => `${gate.name}: ${gate.isPassed ? 'PASS' : 'FAIL'}`)
        .join(', ')
      return `- ${column.label}: ${summary}`
    })
    .join('\n')
}

function renderFrequencyDiff(params: {
  baseline: ReportColumn
  candidate: ReportColumn
  stories: EvaluatedStory[]
}): string {
  const { baseline, candidate, stories } = params
  const entries = diffWordFrequency({
    baseline: stories.map(story => story.texts[baseline.id] ?? ''),
    candidate: stories.map(story => story.texts[candidate.id] ?? ''),
  }).slice(0, 30)
  if (entries.length === 0) {
    return 'None.'
  }
  return renderTable({
    header: ['Word', baseline.label, candidate.label, 'Ratio'],
    rows: entries.map(entry => [
      entry.word,
      String(entry.baselineCount),
      String(entry.candidateCount),
      entry.ratio.toFixed(1),
    ]),
  })
}

function renderSkipped(skipped: SkippedStory[]): string {
  if (skipped.length === 0) {
    return '## Skipped stories\n\nNone.'
  }
  return [
    '## Skipped stories',
    '',
    ...skipped.map(
      story => `- ${story.date} [${story.title}](${hnLink(story.storyId)}): ${story.reason}`,
    ),
  ].join('\n')
}

function renderStory(params: {
  columns: ReportColumn[]
  story: EvaluatedStory
  wpm: number
}): string {
  const { columns, story, wpm } = params
  const texts = columns.map(column => story.texts[column.id] ?? '')
  // One HTML block with no blank lines, so markdown renderers keep it intact
  const sideBySide = [
    '<table>',
    `<tr>${columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>`,
    `<tr>${texts.map(text => `<td valign="top">${escapeHtml(text.trim()).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`,
    '</table>',
  ].join('\n')

  const metricRows = columns.map((column, i) => {
    const text = texts[i] ?? ''
    const sentences = countSentencesPerParagraph(text)
    const banned = countBannedWords(text)
    return [
      column.label,
      String(countWords(text)),
      `${sentences.content} / ${sentences.comments}`,
      formatDuration(estimateAudioSeconds(text, wpm)),
      banned.total === 0 ? '0' : `${banned.total} (${Object.keys(banned.byWord).join(', ')})`,
      checkSummaryFormat(text).join(', ') || 'none',
      detectMarkdown(text).join(', ') || 'none',
    ]
  })

  return [
    `### ${story.date} #${story.rank}: [${story.title}](${hnLink(story.storyId)})`,
    '',
    sideBySide,
    '',
    renderTable({
      header: [
        'Column',
        'Words',
        'Sentences (content / comments)',
        'Est. audio',
        'Banned',
        'Format',
        'Markdown',
      ],
      rows: metricRows,
    }),
  ].join('\n')
}

function renderTable(params: { header: string[]; rows: string[][] }): string {
  const { header, rows } = params
  const line = (cells: string[]) =>
    `| ${cells.map(cell => cell.replace(/\|/g, '\\|')).join(' | ')} |`
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n')
}

function getOrThrow<V>(map: Map<string, V>, key: string): V {
  const value = map.get(key)
  if (value === undefined) {
    throw new Error(`Missing entry for ${key}`)
  }
  return value
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length === 0) {
    return 0
  }
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0
  }
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds)
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

function formatPercent(ratio: number): string {
  const percent = (ratio * 100).toFixed(1)
  return ratio > 0 ? `+${percent}%` : `${percent}%`
}

function hnLink(storyId: number): string {
  return `https://news.ycombinator.com/item?id=${storyId}`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
