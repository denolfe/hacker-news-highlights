/**
 * TTS has issues with specific terms and patterns. This function replaces them with phonetic alternatives.
 */
export function filterPronunciation(text: string): string {
  return (
    text
      // Prevent pronouncing dashes in URLs
      .replace(/(?<=Source: )\S+\b/g, source => source.replace(/-/g, ' '))

      // Add any pronunciation replacements here
      .replace(/\bgzip\b/gi, 'jee-zip')
      .replace(/\bwasm\b/gi, 'wah-zum')
      .replace(/\bsqlite\b/gi, 'ess-cue-lite')

      // Remove any special characters that will never be pronounced properly such as "•" or "|"
      .replace(/[•|]/g, '')
  )
}
