import { z } from 'zod'

/**
 * Parsed, validated application config. The single source of truth for every
 * environment variable the pipeline reads.
 */
const configSchema = z
  .object({
    OPENAI_API_KEY: z
      .string({ required_error: 'Missing required env OPENAI_API_KEY' })
      .min(1, 'Missing required env OPENAI_API_KEY'),
    ELEVEN_LABS_API_KEY: z.string().min(1).optional(),
    TRANSISTOR_API_KEY: z.string().min(1).optional(),
    VOICE_SERVICE: z.string().optional(),
    CI: z.string().optional(),
    SCHEDULED_RELEASE: z.string().optional(),
  })
  .transform(raw => ({
    openaiApiKey: raw.OPENAI_API_KEY,
    elevenLabsApiKey: raw.ELEVEN_LABS_API_KEY,
    transistorApiKey: raw.TRANSISTOR_API_KEY,
    // Only an explicit 'elevenlabs' selects ElevenLabs; anything else is OpenAI.
    voiceService: raw.VOICE_SERVICE === 'elevenlabs' ? ('elevenlabs' as const) : ('openai' as const),
    isCi: Boolean(raw.CI),
    isScheduledRelease: raw.SCHEDULED_RELEASE === 'true',
  }))
  .superRefine((config, ctx) => {
    if (config.isCi && config.voiceService === 'elevenlabs' && !config.elevenLabsApiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Missing required env ELEVEN_LABS_API_KEY',
      })
    }
  })

export type Config = z.infer<typeof configSchema>

/**
 * Parse and validate config from a raw environment. Pure: pass an env object in,
 * get typed config out, or throw on the first validation failure.
 */
export function parseConfig(env: NodeJS.ProcessEnv): Config {
  const result = configSchema.safeParse(env)
  if (!result.success) {
    throw new Error(result.error.issues[0].message)
  }
  return result.data
}

let cached: Config | undefined

/**
 * Load config from `process.env`, validating once and memoizing the result.
 */
export function loadConfig(): Config {
  cached ??= parseConfig(process.env)
  return cached
}
