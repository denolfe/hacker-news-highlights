import { encoding_for_model } from 'tiktoken'

export function estimateTokens(text: string): number {
  const enc = encoding_for_model('gpt-4o-mini')
  const tokens = enc.encode(text)
  enc.free()
  return tokens.length
}
