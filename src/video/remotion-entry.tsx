// @ts-nocheck - Remotion uses Webpack which has different module resolution than Node ESM
import React from 'react'
import { Composition, registerRoot } from 'remotion'

import type { VideoProps } from './types'

import { PodcastVideo } from './composition'

const STORIES = [
  {
    title: '430k-year-old Wooden Tools',
    source: 'NY Times',
    screenshotPath: 'src/video/data/screenshot-nytimes.png',
    url: 'ttps://www.nytimes.com/2026/01/26/science/archaeology-neanderthals-tools.html',
  },
  {
    title: 'Apple introduces new AirTag with longer range and improved findability',
    source: 'Apple',
    screenshotPath: 'src/video/data/screenshot-apple.png',
    url: 'https://www.apple.com/newsroom/2024/03/apple-introduces-new-airtag-with-longer-range-and-improved-findability/',
  },
  {
    title: 'Introducing Prism',
    source: 'openai.com',
    screenshotPath: 'src/video/data/screenshot-openai.png',
    url: 'https://openai.com/research/prism',
  },
]

const PREVIEW_CHAPTERS = [
  {
    type: 'intro',
    title: 'Intro',
    source: 'Hacker News Highlights',
    url: null,
    screenshotPath: '',
    startFrame: 0,
    durationFrames: 450, // 15 seconds for intro
    storyPreviews: STORIES.map(s => ({
      title: s.title,
      source: s.source,
      screenshotPath: s.screenshotPath,
    })),
  },
  {
    type: 'story',
    ...STORIES[0],
    startFrame: 450,
    durationFrames: 150, // 5 seconds
  },
  {
    type: 'story',
    ...STORIES[1],
    startFrame: 600,
    durationFrames: 150, // 5 seconds
  },
  {
    type: 'story',
    ...STORIES[2],
    startFrame: 750,
    durationFrames: 150, // 5 seconds
  },
  {
    type: 'outro',
    title: 'Outro',
    source: 'Hacker News Highlights',
    url: null,
    screenshotPath: '',
    startFrame: 900,
    durationFrames: 60, // 2 seconds
  },
]

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      calculateMetadata={({ props }) => {
        return {
          durationInFrames: props.totalDurationInFrames || 1,
          fps: props.fps || 60,
        }
      }}
      component={PodcastVideo}
      defaultProps={
        {
          chapters: PREVIEW_CHAPTERS,
          fps: 60,
          totalDurationInFrames: 960,
        } satisfies VideoProps
      }
      durationInFrames={660}
      fps={60}
      height={1080}
      id="PodcastVideo"
      width={1920}
    />
  )
}

registerRoot(RemotionRoot)
