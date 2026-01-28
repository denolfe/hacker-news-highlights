// @ts-nocheck - Remotion uses Webpack which has different module resolution than Node ESM
import React from 'react'
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

type BrandingProps = {
  durationFrames: number
}

export const Branding: React.FC<BrandingProps> = ({ durationFrames }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()

  // Fade out over last 20 frames
  const fadeOutStart = durationFrames - 20
  const fadeOut = interpolate(frame, [fadeOutStart, durationFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Fade in over frames 0-20
  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })
  const opacity = Math.min(fadeIn, fadeOut)

  const padding = 80

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding,
        boxSizing: 'border-box',
      }}
    >
      <Img
        src={staticFile('cover.png')}
        style={{
          maxWidth: width - padding * 2,
          maxHeight: height - padding * 2,
          objectFit: 'contain',
          opacity,
        }}
      />
    </div>
  )
}
