import React from 'react'
import { useVideoConfig } from 'remotion'

type BrandingProps = {
  title: string
  subtitle?: string
}

export const Branding: React.FC<BrandingProps> = ({ title, subtitle }) => {
  const { width, height } = useVideoConfig()

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ color: 'white', fontSize: 64, fontWeight: 'bold', textAlign: 'center' }}>
        {title}
      </div>
      {subtitle ? (
        <div style={{ color: '#888', fontSize: 32, marginTop: 20, textAlign: 'center' }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  )
}
