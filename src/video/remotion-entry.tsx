// @ts-nocheck - Remotion uses Webpack which has different module resolution than Node ESM
import React from 'react'
import { Composition, registerRoot } from 'remotion'

import type { VideoProps } from './types'

import { PodcastVideo } from './composition'

// Mock data for Remotion preview
const PREVIEW_CHAPTERS = [
  {
    title: 'Intro',
    source: 'Hacker News Highlights',
    url: null,
    screenshotPath: '',
    startFrame: 0,
    durationFrames: 90, // 3 seconds
  },
  {
    title: 'Example Story Title That Might Be Quite Long',
    source: 'example.com',
    url: 'https://example.com',
    screenshotPath: 'src/video/story-preview.png',
    startFrame: 90,
    durationFrames: 150, // 5 seconds
  },
  {
    title: 'Outro',
    source: 'Hacker News Highlights',
    url: null,
    screenshotPath: '',
    startFrame: 240,
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
          totalDurationInFrames: 300,
        } satisfies VideoProps
      }
      durationInFrames={300}
      fps={30}
      height={1080}
      id="PodcastVideo"
      width={1920}
    />
  )
}

registerRoot(RemotionRoot)
