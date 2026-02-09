// @ts-nocheck - Remotion uses Webpack which has different module resolution than Node ESM
import { loadFont } from '@remotion/google-fonts/Inter'
import { loadFont as loadMonoFont } from '@remotion/google-fonts/JetBrainsMono'
import React from 'react'
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

import type { VideoChapter } from '../types'

import { BACKGROUND_COLOR } from '../constants'

const { fontFamily: interFont } = loadFont('normal', { subsets: ['latin'], weights: ['700'] })
const { fontFamily: jetbrainsFont } = loadMonoFont('normal', {
  subsets: ['latin'],
  weights: ['400'],
})

type ChapterProps = {
  chapter: VideoChapter
}

const BANNER_HEIGHT = 200
const ICON_SIZE = 28

const YouTubeIcon: React.FC = () => (
  <svg height={ICON_SIZE} viewBox="0 0 48 48" width={ICON_SIZE}>
    <path
      d="M47.5 14.4s-.5-3.3-1.9-4.8c-1.8-1.9-3.9-1.9-4.8-2C34.1 7 24 7 24 7s-10.1 0-16.8.6c-.9.1-3 .1-4.8 2-1.4 1.5-1.9 4.8-1.9 4.8S0 18.3 0 22.2v3.6c0 3.9.5 7.8.5 7.8s.5 3.3 1.9 4.8c1.8 1.9 4.2 1.8 5.3 2 3.8.4 16.3.5 16.3.5s10.1 0 16.8-.6c.9-.1 3-.1 4.8-2 1.4-1.5 1.9-4.8 1.9-4.8s.5-3.9.5-7.8v-3.6c0-3.9-.5-7.8-.5-7.8z"
      fill="#FF0000"
    />
    <path d="M19 31V17l13 7z" fill="#FFF" />
  </svg>
)

const GitHubIcon: React.FC = () => (
  <svg height={ICON_SIZE} viewBox="0 0 48 48" width={ICON_SIZE}>
    <path
      d="M24 4C12.95 4 4 12.95 4 24c0 8.84 5.73 16.33 13.67 18.98.99.18 1.36-.43 1.36-.96 0-.47-.02-1.72-.03-3.38-5.56 1.21-6.73-2.68-6.73-2.68-.91-2.31-2.22-2.92-2.22-2.92-1.81-1.24.14-1.21.14-1.21 2 .14 3.06 2.06 3.06 2.06 1.78 3.05 4.67 2.17 5.81 1.66.18-1.29.7-2.17 1.27-2.67-4.44-.5-9.11-2.22-9.11-9.87 0-2.18.78-3.96 2.05-5.36-.2-.5-.89-2.53.2-5.28 0 0 1.67-.54 5.48 2.05 1.59-.44 3.3-.66 5-.67 1.7.01 3.41.23 5 .67 3.8-2.59 5.47-2.05 5.47-2.05 1.09 2.75.4 4.78.2 5.28 1.28 1.4 2.05 3.18 2.05 5.36 0 7.67-4.68 9.36-9.14 9.85.72.62 1.36 1.84 1.36 3.71 0 2.68-.02 4.84-.02 5.5 0 .53.36 1.15 1.38.96C38.28 40.32 44 32.84 44 24 44 12.95 35.05 4 24 4z"
      fill="#fff"
    />
  </svg>
)

const SourceIcon: React.FC<{ url: null | string }> = ({ url }) => {
  if (!url) {
    return null
  }

  const hostname = new URL(url).hostname.toLowerCase()

  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    return <YouTubeIcon />
  }

  if (hostname.includes('github.com')) {
    return <GitHubIcon />
  }

  return null
}

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
  const screenshotYIn = interpolate(frame, [0, 20], [50, 0], { extrapolateRight: 'clamp' })
  const screenshotYOut = interpolate(frame, [fadeOutStart, durationFrames], [0, 50], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const screenshotY = screenshotYIn + screenshotYOut

  // Slow zoom over chapter duration
  const screenshotScale = interpolate(frame, [0, durationFrames], [1, 1.08], {
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: BACKGROUND_COLOR,
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
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 8,
            opacity: sourceOpacity,
          }}
        >
          <SourceIcon url={chapter.url} />
          <span
            style={{
              color: '#888',
              fontSize: 24,
              fontFamily: jetbrainsFont,
            }}
          >
            {chapter.source}
          </span>
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
              transform: `translateY(${screenshotY}px) scale(${screenshotScale})`,
              borderRadius: '16px 16px 0 0',
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
