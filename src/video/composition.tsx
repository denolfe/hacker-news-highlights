// @ts-nocheck - Remotion uses Webpack which has different module resolution than Node ESM
import React from 'react'
import { AbsoluteFill, Sequence } from 'remotion'

import type { VideoProps } from './types'

import { Branding } from './components/Branding'
import { Chapter } from './components/Chapter'
import { Intro } from './components/Intro'

export const PodcastVideo: React.FC<VideoProps> = ({ chapters }) => {
  const renderChapter = (chapter: (typeof chapters)[0]) => {
    switch (chapter.type) {
      case 'intro':
        return (
          <Intro
            durationFrames={chapter.durationFrames}
            storyPreviews={chapter.storyPreviews || []}
          />
        )
      case 'outro':
        return <Branding durationFrames={chapter.durationFrames} />
      case 'story':
      default:
        return <Chapter chapter={chapter} />
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a1a' }}>
      {chapters.map((chapter, index) => (
        <Sequence durationInFrames={chapter.durationFrames} from={chapter.startFrame} key={index}>
          {renderChapter(chapter)}
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
