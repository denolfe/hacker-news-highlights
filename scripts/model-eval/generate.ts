import type { OpenAIProvider } from '@ai-sdk/openai'

import { generateText } from 'ai'

import { getOrComputeJson } from './cache.js'

export type TokenUsage = {
  /** All input tokens, cached included */
  inputTokens: number
  cachedInputTokens: number
  /** All output tokens, reasoning included */
  outputTokens: number
  reasoningTokens: number
}

/** USD per 1M tokens, Standard tier */
type Pricing = {
  input: number
  cachedInput: number
  output: number
}

/** Luna settings sent as OpenAI provider options; values match `OpenAILanguageModelResponsesOptions` */
type LunaSetting = {
  reasoningEffort: 'low' | 'none'
  textVerbosity: 'medium'
}

export type GenerationColumn = {
  /** Unique per model and setting; also the generation cache dir */
  id: string
  label: string
  model: string
  lunaSetting?: LunaSetting
  pricing: Pricing
}

export type Generation = {
  text: string
  usage: TokenUsage
}

const NANO_PRICING: Pricing = { input: 0.1, cachedInput: 0.025, output: 0.4 }
const LUNA_PRICING: Pricing = { input: 0.2, cachedInput: 0.02, output: 1.2 }

export const NANO_COLUMN: GenerationColumn = {
  id: 'gpt-4.1-nano',
  label: 'nano',
  model: 'gpt-4.1-nano',
  pricing: NANO_PRICING,
}

export const LUNA_COLUMNS: GenerationColumn[] = [
  {
    id: 'gpt-5.6-luna-none-medium',
    label: 'luna none/medium',
    model: 'gpt-5.6-luna',
    lunaSetting: { reasoningEffort: 'none', textVerbosity: 'medium' },
    pricing: LUNA_PRICING,
  },
  {
    id: 'gpt-5.6-luna-low-medium',
    label: 'luna low/medium',
    model: 'gpt-5.6-luna',
    lunaSetting: { reasoningEffort: 'low', textVerbosity: 'medium' },
    pricing: LUNA_PRICING,
  },
]

/** Generates text for one column, cached per column and key so reruns make no API calls. */
export async function generateCached(params: {
  cacheKey: string
  column: GenerationColumn
  openai: OpenAIProvider
  prompt: string
}): Promise<Generation> {
  const { cacheKey, column, openai, prompt } = params
  return await getOrComputeJson(`generations/${column.id}/${cacheKey}.json`, async () => {
    const { text, usage } = await generateText({
      model: openai(column.model),
      prompt,
      providerOptions: column.lunaSetting ? { openai: column.lunaSetting } : undefined,
    })
    return {
      text,
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        cachedInputTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        reasoningTokens: usage.outputTokenDetails.reasoningTokens ?? 0,
      },
    }
  })
}

export function sumUsage(usages: TokenUsage[]): TokenUsage {
  return usages.reduce(
    (total, usage) => ({
      inputTokens: total.inputTokens + usage.inputTokens,
      cachedInputTokens: total.cachedInputTokens + usage.cachedInputTokens,
      outputTokens: total.outputTokens + usage.outputTokens,
      reasoningTokens: total.reasoningTokens + usage.reasoningTokens,
    }),
    { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
  )
}

/** Reasoning tokens bill as output, so they are already inside `outputTokens`. */
export function priceUsage(params: { pricing: Pricing; usage: TokenUsage }): number {
  const { pricing, usage } = params
  const uncachedInput = usage.inputTokens - usage.cachedInputTokens
  return (
    (uncachedInput * pricing.input +
      usage.cachedInputTokens * pricing.cachedInput +
      usage.outputTokens * pricing.output) /
    1_000_000
  )
}
