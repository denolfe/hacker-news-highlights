export type VideoChapter = {
  title: string
  source: string
  url: null | string
  screenshotPath: string
  startFrame: number
  durationFrames: number
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
