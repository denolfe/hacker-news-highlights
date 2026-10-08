import { describe, expect, it } from 'vitest'

import type { GateMetrics, ReportColumn } from './report.js'

import { pickWinningSetting, renderReport } from './report.js'

const nano: GateMetrics = {
  columnId: 'nano',
  medianEpisodeSeconds: 800,
  bannedHits: 10,
  formatFailures: 2,
  markdownLeaks: 0,
}

describe('pickWinningSetting', () => {
  it('picks the candidate that passes more ship gates', () => {
    const tooShort: GateMetrics = {
      columnId: 'luna-none',
      medianEpisodeSeconds: 640, // -20%
      bannedHits: 0,
      formatFailures: 0,
      markdownLeaks: 0,
    }
    const passesAll: GateMetrics = {
      columnId: 'luna-low',
      medianEpisodeSeconds: 760, // -5%
      bannedHits: 10,
      formatFailures: 2,
      markdownLeaks: 0,
    }
    expect(pickWinningSetting({ baseline: nano, candidates: [tooShort, passesAll] }).columnId).toBe(
      'luna-low',
    )
  })

  it('breaks a gate tie by the smaller length change from the baseline', () => {
    const minus10: GateMetrics = { ...nano, columnId: 'luna-none', medianEpisodeSeconds: 720 }
    const plus5: GateMetrics = { ...nano, columnId: 'luna-low', medianEpisodeSeconds: 840 }
    expect(pickWinningSetting({ baseline: nano, candidates: [minus10, plus5] }).columnId).toBe(
      'luna-low',
    )
  })
})

const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ')
const ci: ReportColumn = { id: 'ci', label: 'CI' }
const baseline: ReportColumn = { id: 'nano', label: 'Nano' }
const candidate: ReportColumn = { id: 'luna', label: 'Luna' }

function storyWithWords(params: { artifactId: number; storyId: number; wordCount: number }) {
  const text = words(params.wordCount)
  return {
    artifactId: params.artifactId,
    date: '2026-10-07',
    rank: 1,
    storyId: params.storyId,
    title: `Story ${params.storyId}`,
    texts: { ci: text, nano: text, luna: text },
  }
}

/** Returns the cells of the first table row for a column label after a heading. */
function tableRow(params: { heading: string; label: string; report: string }): string[] {
  const section = params.report.slice(params.report.indexOf(params.heading))
  const row = section.split('\n').find(line => line.startsWith(`| ${params.label} |`))
  return (row ?? '').split(' | ').map(cell => cell.replace(/^\| | \|$/g, ''))
}

describe('renderReport', () => {
  it('counts two artifacts from the same day as separate episodes', () => {
    const report = renderReport({
      baseline,
      candidates: [candidate],
      ci,
      introTitle: { columns: [ci], episodes: [] },
      isDefaultWpm: false,
      skipped: [],
      stories: [
        storyWithWords({ artifactId: 1, storyId: 10, wordCount: 60 }),
        storyWithWords({ artifactId: 2, storyId: 20, wordCount: 60 }),
      ],
      wpm: 60,
    })
    // 60 words at 60 WPM is one minute per episode
    expect(tableRow({ heading: '## Aggregate', label: 'CI', report })[1]).toBe('1:00')
  })

  it('counts each episode missing an intro or a title as missing', () => {
    const report = renderReport({
      baseline,
      candidates: [candidate],
      ci,
      introTitle: {
        columns: [ci],
        episodes: [
          { date: '2026-10-06', intros: { ci: 'An intro.' }, titles: {} },
          { date: '2026-10-07', intros: {}, titles: { ci: 'A title' } },
          { date: '2026-10-08', intros: { ci: 'An intro.' }, titles: { ci: 'A title' } },
        ],
      },
      isDefaultWpm: false,
      skipped: [],
      stories: [storyWithWords({ artifactId: 1, storyId: 10, wordCount: 60 })],
      wpm: 60,
    })
    const missingColumn = 6
    expect(
      tableRow({ heading: '## Intro and title aggregate', label: 'CI', report })[missingColumn],
    ).toBe('2')
  })
})
