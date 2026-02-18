import { encoding_for_model } from 'tiktoken'

export function estimateTokens(text: string): number {
  // gpt-4.1-nano uses same tokenizer as gpt-4o-mini
  const enc = encoding_for_model('gpt-4o-mini')
  const tokens = enc.encode(text)
  enc.free()
  return tokens.length
}
