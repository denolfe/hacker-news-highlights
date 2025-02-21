/**
 * TTS has issues with specific terms and patterns. This function replaces them with phonetic alternatives.
 */
export function filterPronunciation(text: string): string {
  return (
    text
      // Prevent pronouncing dashes in URLs
      .replace(/(?<=Source: )\S+\b/g, source => source.replace(/-/g, ' '))

      // Add any pronunciation replacements here
      .replace(/\bgui\b/gi, 'gooey')
      .replace(/\bgzip\b/gi, 'jee-zip')
      .replace(/\bpostgresql\b/gi, 'post-gress-cue-ell')
      .replace(/\bregex\b/gi, 'rehh-jecks')
      .replace(/\browid\b/gi, 'row ID')
      .replace(/\bsql\b/gi, 'sequel')
      .replace(/\bsqlite\b/gi, 'ess-cue-lite')
      .replace(/\bwasm\b/gi, 'wazum')
      .replace(/\bmemecoin\b/gi, 'meme-coin')
      .replace(/\bvram\b/gi, 'vee-ram')
      .replace(/\bcodegen\b/gi, 'code-gen')
      .replace(/\bbluesky\b/gi, 'blue-sky')
      .replace(/\bgnu\b/gi, 'guh-new')

      // Grok
      .replace(/\bgrok\b/gi, 'grock')
      .replace(/\bgrok(\d)\b/gi, 'grock $1')

      // Remove any special characters that will never be pronounced properly such as "•" or "|"
      .replace(/[•|]/g, '')
  )
}
