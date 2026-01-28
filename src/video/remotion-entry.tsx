// @ts-nocheck - Remotion uses Webpack which has different module resolution than Node ESM
import React from 'react'
import { Composition, registerRoot } from 'remotion'

import type { VideoProps } from './types'

import { PodcastVideo } from './composition'

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
          chapters: [],
          fps: 30,
          totalDurationInFrames: 1,
        } satisfies VideoProps
      }
      durationInFrames={1}
      fps={30}
      height={1080}
      id="PodcastVideo"
      width={1920}
    />
  )
}

registerRoot(RemotionRoot)
