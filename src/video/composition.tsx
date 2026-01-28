// @ts-nocheck - Remotion uses Webpack which has different module resolution than Node ESM
import React from 'react'
import { AbsoluteFill, Sequence } from 'remotion'

import type { VideoProps } from './types'

import { Branding } from './components/Branding'
import { Chapter } from './components/Chapter'

export const PodcastVideo: React.FC<VideoProps> = ({ chapters }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a1a' }}>
      {chapters.map((chapter, index) => (
        <Sequence durationInFrames={chapter.durationFrames} from={chapter.startFrame} key={index}>
          {chapter.screenshotPath ? (
            <Chapter chapter={chapter} />
          ) : (
            <Branding title={chapter.title} />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
