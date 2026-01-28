export type StoryPreview = {
  title: string
  source: string
  screenshotPath: string
}

export type VideoChapter = {
  type: 'intro' | 'outro' | 'story'
  title: string
  source: string
  url: null | string
  screenshotPath: string
  startFrame: number
  durationFrames: number
  storyPreviews?: StoryPreview[] // Only for intro
}

export type VideoProps = {
  chapters: VideoChapter[]
  fps: number
  totalDurationInFrames: number
}

export type ChapterInput = {
  title: string
  source: string
  url: null | string
  storyId: string
  start: number
  end: number
}
