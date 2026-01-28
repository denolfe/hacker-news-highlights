import { loadFont } from '@remotion/google-fonts/Inter'
import { loadFont as loadMonoFont } from '@remotion/google-fonts/JetBrainsMono'
// @ts-nocheck - Remotion uses Webpack which has different module resolution than Node ESM
import React from 'react'
import { Img, staticFile, useVideoConfig } from 'remotion'

import type { VideoChapter } from '../types'

const { fontFamily: interFont } = loadFont()
const { fontFamily: jetbrainsFont } = loadMonoFont()

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
            fontFamily: interFont,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {chapter.title}
        </div>
        <div style={{ color: '#888', fontSize: 24, marginTop: 8, fontFamily: jetbrainsFont }}>
          {chapter.source}
        </div>
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
            src={staticFile(chapter.screenshotPath)}
            style={{ maxWidth: width, maxHeight: screenshotHeight, objectFit: 'contain' }}
          />
        ) : null}
      </div>
    </div>
  )
}
