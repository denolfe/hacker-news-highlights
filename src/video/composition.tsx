import React from 'react'
import { AbsoluteFill, Sequence } from 'remotion'

import type { VideoProps } from './types.js'

import { Branding } from './components/Branding.js'
import { Chapter } from './components/Chapter.js'

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
