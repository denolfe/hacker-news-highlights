// @ts-nocheck - Remotion uses Webpack which has different module resolution than Node ESM
import React from 'react'
import { Composition, registerRoot } from 'remotion'

import type { VideoProps } from './types'

import { PodcastVideo } from './composition'

// Mock data for Remotion preview
const PREVIEW_STORIES = [
  {
    title: 'First Story With a Longer Title Here',
    source: 'example.com',
    screenshotPath: 'src/video/story-preview.png',
  },
  {
    title: 'Second Story About Something Interesting',
    source: 'github.com',
    screenshotPath: 'src/video/story-preview.png',
  },
  {
    title: 'Third Story on Tech News Today',
    source: 'techcrunch.com',
    screenshotPath: 'src/video/story-preview.png',
  },
]

const PREVIEW_CHAPTERS = [
  {
    type: 'intro' as const,
    title: 'Intro',
    source: 'Hacker News Highlights',
    url: null,
    screenshotPath: '',
    startFrame: 0,
    durationFrames: 450, // 15 seconds for intro
    storyPreviews: PREVIEW_STORIES,
  },
  {
    type: 'story' as const,
    title: 'Example Story Title That Might Be Quite Long',
    source: 'example.com',
    url: 'https://example.com',
    screenshotPath: 'src/video/story-preview.png',
    startFrame: 450,
    durationFrames: 150, // 5 seconds
  },
  {
    type: 'outro' as const,
    title: 'Outro',
    source: 'Hacker News Highlights',
    url: null,
    screenshotPath: '',
    startFrame: 600,
    durationFrames: 60, // 2 seconds
  },
]

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      calculateMetadata={({ props }) => {
        return {
          durationInFrames: props.totalDurationInFrames || 1,
          fps: props.fps || 30,
        }
      }}
      component={PodcastVideo}
      defaultProps={
        {
          chapters: PREVIEW_CHAPTERS,
          fps: 30,
          totalDurationInFrames: 660,
        } satisfies VideoProps
      }
      durationInFrames={660}
      fps={30}
      height={1080}
      id="PodcastVideo"
      width={1920}
    />
  )
}

registerRoot(RemotionRoot)
