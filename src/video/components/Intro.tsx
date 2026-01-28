// @ts-nocheck - Remotion uses Webpack which has different module resolution than Node ESM
import { loadFont } from '@remotion/google-fonts/Inter'
import { loadFont as loadMonoFont } from '@remotion/google-fonts/JetBrainsMono'
import React from 'react'
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

import type { StoryPreview } from '../types'

const { fontFamily: interFont } = loadFont('normal', { subsets: ['latin'], weights: ['700'] })
const { fontFamily: jetbrainsFont } = loadMonoFont('normal', {
  subsets: ['latin'],
  weights: ['400'],
})

type IntroProps = {
  durationFrames: number
  storyPreviews: StoryPreview[]
}

const LOGO_FINAL_SIZE = 120
const LOGO_FINAL_BOTTOM = 20
const LOGO_FINAL_LEFT = 20
const LOGO_ANIM_START = 60
const LOGO_ANIM_END = 90
const FADE_OUT_FRAMES = 30

export const Intro: React.FC<IntroProps> = ({ durationFrames, storyPreviews }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()

  // Timing segments
  const storiesStartFrame = LOGO_ANIM_END
  const fadeOutStart = durationFrames - FADE_OUT_FRAMES
  const storiesEndFrame = fadeOutStart
  const storiesDuration = storiesEndFrame - storiesStartFrame
  const storyCount = Math.min(storyPreviews.length, 3)
  const framesPerStory = storyCount > 0 ? storiesDuration / storyCount : 0

  // Global fade out
  const fadeOut = interpolate(frame, [fadeOutStart, durationFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Cover animation: fade in (0-20), centered (0-60), move to corner (60-90)
  const coverFadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })
  const coverOpacity = Math.min(coverFadeIn, fadeOut)

  const coverStartSize = 700
  const coverSize = interpolate(
    frame,
    [LOGO_ANIM_START, LOGO_ANIM_END],
    [coverStartSize, LOGO_FINAL_SIZE],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  )

  const coverCenterX = width / 2 - coverStartSize / 2
  const coverCenterY = height / 2 - coverStartSize / 2
  const coverX = interpolate(
    frame,
    [LOGO_ANIM_START, LOGO_ANIM_END],
    [coverCenterX, LOGO_FINAL_LEFT],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  )
  const coverY = interpolate(
    frame,
    [LOGO_ANIM_START, LOGO_ANIM_END],
    [coverCenterY, height - LOGO_FINAL_BOTTOM - LOGO_FINAL_SIZE],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  )

  // Story card dimensions - large and centered
  const cardWidth = width * 0.7
  const textSectionHeight = 120
  const cardHeight = height * 0.7 + textSectionHeight
  const cardX = (width - cardWidth) / 2
  const cardY = (height - cardHeight) / 2
  const screenshotHeight = cardHeight - textSectionHeight

  return (
    <div style={{ width, height, backgroundColor: '#1a1a1a', position: 'relative' }}>
      {/* Cover image */}
      <Img
        src={staticFile('cover.png')}
        style={{
          position: 'absolute',
          left: coverX,
          top: coverY,
          width: coverSize,
          height: coverSize,
          objectFit: 'contain',
          opacity: coverOpacity,
        }}
      />

      {/* Story cards - sequential fade through */}
      {storyPreviews.slice(0, 3).map((story, index) => {
        const storyStart = storiesStartFrame + index * framesPerStory
        const storyEnd = storyStart + framesPerStory

        // Fade in over 20 frames, hold, fade out over 20 frames
        const fadeInEnd = storyStart + 20
        const fadeOutStoryStart = storyEnd - 20

        const storyFadeIn = interpolate(frame, [storyStart, fadeInEnd], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
        const storyFadeOut = interpolate(frame, [fadeOutStoryStart, storyEnd], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })

        // Combine: fade in, hold at 1, fade out (but also respect global fade out)
        const storyOpacity = Math.min(storyFadeIn, storyFadeOut, fadeOut)

        // Scale animation: 0.9 → 1 on fade in
        const scale = interpolate(frame, [storyStart, fadeInEnd], [0.95, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })

        // Staggered title/source fade in (like Chapter component)
        const titleFadeIn = interpolate(frame, [storyStart, storyStart + 15], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
        const titleOpacity = Math.min(titleFadeIn, storyFadeOut, fadeOut)

        const sourceFadeIn = interpolate(frame, [storyStart + 9, storyStart + 24], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
        const sourceOpacity = Math.min(sourceFadeIn, storyFadeOut, fadeOut)

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: cardX,
              top: cardY,
              width: cardWidth,
              height: cardHeight,
              borderRadius: 16,
              overflow: 'hidden',
              opacity: storyOpacity,
              transform: `scale(${scale})`,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ height: screenshotHeight, overflow: 'hidden', borderRadius: 16 }}>
              {story.screenshotPath ? (
                <Img
                  src={staticFile(story.screenshotPath)}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', backgroundColor: '#2a2a2a' }} />
              )}
            </div>
            <div
              style={{
                height: textSectionHeight,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  color: 'white',
                  fontSize: 32,
                  fontFamily: interFont,
                  fontWeight: 'bold',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  padding: '0 32px',
                  opacity: titleOpacity,
                }}
              >
                {story.title}
              </div>
              <div
                style={{
                  color: '#888',
                  fontSize: 22,
                  marginTop: 4,
                  fontFamily: jetbrainsFont,
                  opacity: sourceOpacity,
                }}
              >
                {story.source}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
