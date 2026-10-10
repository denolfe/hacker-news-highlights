import { describe, expect, it } from 'vitest'

import {
  extractIntroSentence,
  parseChapterDurations,
  parseShowNotes,
  selectPublishedArtifacts,
  stripTitleDatePrefix,
} from './artifacts.js'

describe('parseShowNotes', () => {
  it('returns stories in show-notes order, with or without an article link', () => {
    const showNotes = `This is a recap of the top 10 posts on Hacker News on Oct 7, 2026.

Feel free to leave feedback on Github: https://github.com/denolfe/hacker-news-highlights

{{chapters}}

Mistral Large 4
https://mistral.ai/news/mistral-large-4/\\
https://news.ycombinator.com/item?id=49977979

Tell HN: GitHub refuses to remove cracked copies
https://news.ycombinator.com/item?id=49982498

OpenTPU – An open-source AI accelerator
https://github.com/FeSens/openTPU
https://news.ycombinator.com/item?id=49980715
`
    expect(parseShowNotes(showNotes)).toEqual([
      { storyId: 49977979, title: 'Mistral Large 4' },
      { storyId: 49982498, title: 'Tell HN: GitHub refuses to remove cracked copies' },
      { storyId: 49980715, title: 'OpenTPU – An open-source AI accelerator' },
    ])
  })
})

describe('parseChapterDurations', () => {
  it('returns each chapter title with END minus START in seconds', () => {
    const chapters = `;FFMETADATA1

[CHAPTER]
TIMEBASE=1/1000
START=0
END=17867
title=Intro

[CHAPTER]
TIMEBASE=1/1000
START=19017
END=100127
title=Mistral Large 4

[CHAPTER]
TIMEBASE=1/1000
START=101276
END=184398
title=a=b; c
`
    expect(parseChapterDurations(chapters)).toEqual([
      { title: 'Intro', durationSeconds: 17.867 },
      { title: 'Mistral Large 4', durationSeconds: 81.11 },
      { title: 'a=b; c', durationSeconds: 83.122 },
    ])
  })
})

describe('extractIntroSentence', () => {
  it('returns only the LLM sentence, without the welcome line, break tag, or imperative line', () => {
    const intro = `
Welcome to the Hacker News Highlights, where we explore the top 10 posts on Hacker News every day.

Today, we dive into Mistral Large 4 pushing open-weight AI performance... releasing EmbeddingGemma 2... and sharing progress in mathematics.

<break time="0.5s" />

Let's get into it.
`
    expect(extractIntroSentence(intro)).toBe(
      'Today, we dive into Mistral Large 4 pushing open-weight AI performance... releasing EmbeddingGemma 2... and sharing progress in mathematics.',
    )
  })
})

describe('stripTitleDatePrefix', () => {
  it('drops the date key and separator, keeping later separators in the LLM text', () => {
    expect(stripTitleDatePrefix('10.7.26 | Mistral Large 4, AI | math, EmbeddingGemma 2')).toBe(
      'Mistral Large 4, AI | math, EmbeddingGemma 2',
    )
  })
})

describe('selectPublishedArtifacts', () => {
  it('keeps the newest unexpired artifacts from published runs only', () => {
    const artifact = (id: number, createdAt: string, runId: number, isExpired = false) => ({
      created_at: createdAt,
      expired: isExpired,
      id,
      workflow_run: { id: runId },
    })
    const artifacts = [
      artifact(1, '2026-10-01T12:00:00Z', 101),
      artifact(2, '2026-10-03T12:00:00Z', 102),
      artifact(3, '2026-10-04T12:00:00Z', 999), // failed or manual run
      artifact(4, '2026-10-02T12:00:00Z', 104),
      artifact(5, '2026-10-05T12:00:00Z', 105, true),
    ]
    const selected = selectPublishedArtifacts({
      artifacts,
      count: 2,
      publishedRunIds: new Set([101, 102, 104, 105]),
    })
    expect(selected.map(a => a.id)).toEqual([2, 4])
  })
})
