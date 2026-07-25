import { describe, expect, it } from 'vitest'

import { parseConfig } from './config.js'

const baseEnv = { OPENAI_API_KEY: 'sk-test' }

describe('parseConfig', () => {
  it('parses a minimal valid env', () => {
    const config = parseConfig(baseEnv)

    expect(config).toEqual({
      openaiApiKey: 'sk-test',
      elevenLabsApiKey: undefined,
      transistorApiKey: undefined,
      voiceService: 'openai',
      isCi: false,
      isScheduledRelease: false,
    })
  })

  it('throws when OPENAI_API_KEY is missing', () => {
    expect(() => parseConfig({})).toThrow('Missing required env OPENAI_API_KEY')
  })

  it('throws when OPENAI_API_KEY is empty', () => {
    expect(() => parseConfig({ OPENAI_API_KEY: '' })).toThrow('Missing required env OPENAI_API_KEY')
  })

  it('ignores unrelated env vars', () => {
    const config = parseConfig({ ...baseEnv, PATH: '/usr/bin', HOME: '/home/x' })

    expect(config.openaiApiKey).toBe('sk-test')
  })

  it('selects elevenlabs only for an exact match', () => {
    expect(parseConfig({ ...baseEnv, VOICE_SERVICE: 'elevenlabs' }).voiceService).toBe('elevenlabs')
    expect(parseConfig({ ...baseEnv, VOICE_SERVICE: 'openai' }).voiceService).toBe('openai')
    expect(parseConfig({ ...baseEnv, VOICE_SERVICE: 'ElevenLabs' }).voiceService).toBe('openai')
    expect(parseConfig({ ...baseEnv, VOICE_SERVICE: '' }).voiceService).toBe('openai')
  })

  it('treats any non-empty CI value as running in CI', () => {
    expect(parseConfig({ ...baseEnv, CI: 'true' }).isCi).toBe(true)
    expect(parseConfig({ ...baseEnv, CI: '1' }).isCi).toBe(true)
    expect(parseConfig({ ...baseEnv, CI: '' }).isCi).toBe(false)
  })

  it('flags a scheduled release only for the literal "true"', () => {
    expect(parseConfig({ ...baseEnv, SCHEDULED_RELEASE: 'true' }).isScheduledRelease).toBe(true)
    expect(parseConfig({ ...baseEnv, SCHEDULED_RELEASE: 'false' }).isScheduledRelease).toBe(false)
  })

  it('requires the ElevenLabs key when selecting elevenlabs in CI', () => {
    expect(() =>
      parseConfig({ ...baseEnv, CI: 'true', VOICE_SERVICE: 'elevenlabs' }),
    ).toThrow('Missing required env ELEVEN_LABS_API_KEY')
  })

  it('allows elevenlabs without the key outside CI', () => {
    const config = parseConfig({ ...baseEnv, VOICE_SERVICE: 'elevenlabs' })

    expect(config.voiceService).toBe('elevenlabs')
    expect(config.elevenLabsApiKey).toBeUndefined()
  })

  it('accepts the ElevenLabs key when provided in CI', () => {
    const config = parseConfig({
      ...baseEnv,
      CI: 'true',
      VOICE_SERVICE: 'elevenlabs',
      ELEVEN_LABS_API_KEY: 'el-key',
    })

    expect(config.elevenLabsApiKey).toBe('el-key')
  })
})
