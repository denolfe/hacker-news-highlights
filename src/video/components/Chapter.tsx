import React from 'react'
import { Img, useVideoConfig } from 'remotion'

import type { VideoChapter } from '../types.js'

type ChapterProps = {
  chapter: VideoChapter
}

const BANNER_HEIGHT = 200

export const Chapter: React.FC<ChapterProps> = ({ chapter }) => {
  const { width, height } = useVideoConfig()
  const screenshotHeight = height - BANNER_HEIGHT

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: BANNER_HEIGHT,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 40px',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: 36,
            fontWeight: 'bold',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {chapter.title}
        </div>
        <div style={{ color: '#888', fontSize: 24, marginTop: 8 }}>{chapter.source}</div>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {chapter.screenshotPath ? (
          <Img
            src={chapter.screenshotPath}
            style={{ maxWidth: width, maxHeight: screenshotHeight, objectFit: 'contain' }}
          />
        ) : null}
      </div>
    </div>
  )
}
