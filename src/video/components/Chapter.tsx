// @ts-nocheck - Remotion uses Webpack which has different module resolution than Node ESM
import { loadFont } from '@remotion/google-fonts/Inter'
import { loadFont as loadMonoFont } from '@remotion/google-fonts/JetBrainsMono'
import React from 'react'
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

import type { VideoChapter } from '../types'

const { fontFamily: interFont } = loadFont('normal', { subsets: ['latin'], weights: ['700'] })
const { fontFamily: jetbrainsFont } = loadMonoFont('normal', {
  subsets: ['latin'],
  weights: ['400'],
})

type ChapterProps = {
  chapter: VideoChapter
}

const BANNER_HEIGHT = 200

export const Chapter: React.FC<ChapterProps> = ({ chapter }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const screenshotHeight = height - BANNER_HEIGHT
  const { durationFrames } = chapter

  // Fade out over last 20 frames
  const fadeOutStart = durationFrames - 20
  const fadeOut = interpolate(frame, [fadeOutStart, durationFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Title fades in over frames 0-15
  const titleFadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })
  const titleOpacity = Math.min(titleFadeIn, fadeOut)

  // Source fades in with 0.3s delay (9 frames at 30fps)
  const sourceFadeIn = interpolate(frame, [9, 24], [0, 1], { extrapolateRight: 'clamp' })
  const sourceOpacity = Math.min(sourceFadeIn, fadeOut)

  // Screenshot slides up from +50px and fades in over frames 0-20
  const screenshotFadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })
  const screenshotOpacity = Math.min(screenshotFadeIn, fadeOut)
  const screenshotY = interpolate(frame, [0, 20], [50, 0], { extrapolateRight: 'clamp' })

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
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0 40px',
          textAlign: 'center',
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
            opacity: titleOpacity,
          }}
        >
          {chapter.title}
        </div>
        <div
          style={{
            color: '#888',
            fontSize: 24,
            marginTop: 8,
            fontFamily: jetbrainsFont,
            opacity: sourceOpacity,
          }}
        >
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
          position: 'relative',
        }}
      >
        {chapter.screenshotPath ? (
          <Img
            src={staticFile(chapter.screenshotPath)}
            style={{
              maxWidth: width,
              maxHeight: screenshotHeight,
              objectFit: 'contain',
              opacity: screenshotOpacity,
              transform: `translateY(${screenshotY}px)`,
              borderRadius: '16px 16px 0 0',
            }}
          />
        ) : null}
        <Img
          src={staticFile('cover.png')}
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            width: 120,
            height: 'auto',
            opacity: screenshotOpacity,
          }}
        />
      </div>
    </div>
  )
}
