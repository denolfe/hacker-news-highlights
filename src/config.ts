import { z } from 'zod'

/**
 * Parsed, validated config for the credentials and run-mode flags the pipeline
 * needs. `DEBUG` is deliberately excluded: logging must work before, and
 * independently of, config validation (see `isDebug` in `utils/log.ts`).
 */
const configSchema = z
  .object({
    OPENAI_API_KEY: z
      .string({ required_error: 'Missing required env OPENAI_API_KEY' })
      .min(1, 'Missing required env OPENAI_API_KEY'),
    // An unset secret expands to an empty string in CI, so treat '' as absent
    ELEVEN_LABS_API_KEY: z.string().min(1, 'Missing required env ELEVEN_LABS_API_KEY').optional(),
    TRANSISTOR_API_KEY: z.string().min(1, 'Missing required env TRANSISTOR_API_KEY').optional(),
    VOICE_SERVICE: z.string().optional(),
    CI: z.string().optional(),
    SCHEDULED_RELEASE: z.string().optional(),
  })
  .transform(raw => ({
    openaiApiKey: raw.OPENAI_API_KEY,
    elevenLabsApiKey: raw.ELEVEN_LABS_API_KEY,
    transistorApiKey: raw.TRANSISTOR_API_KEY,
    // Only an explicit 'elevenlabs' selects ElevenLabs; anything else is OpenAI.
    voiceService:
      raw.VOICE_SERVICE === 'elevenlabs' ? ('elevenlabs' as const) : ('openai' as const),
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
 * get typed config out, or throw listing every validation failure at once.
 */
export function parseConfig(env: NodeJS.ProcessEnv): Config {
  const result = configSchema.safeParse(env)
  if (!result.success) {
    throw new Error(result.error.issues.map(issue => issue.message).join('\n'))
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
