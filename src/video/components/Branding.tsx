// @ts-nocheck - Remotion uses Webpack which has different module resolution than Node ESM
import React from 'react'
import { Img, staticFile, useVideoConfig } from 'remotion'

export const Branding: React.FC = () => {
  const { width, height } = useVideoConfig()

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#1a1a1a',
      }}
    >
      <Img
        src={staticFile('cover.png')}
        style={{
          width,
          height,
          objectFit: 'cover',
        }}
      />
    </div>
  )
}
