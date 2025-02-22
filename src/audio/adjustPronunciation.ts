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
      .replace(/\bnext\.js\b/gi, 'next-jay-ess')

      // Grok
      .replace(/\bgrok\b/gi, 'grock')
      .replace(/\bgrok(\d)\b/gi, 'grock $1')

      // For words with a '.' followed by a comma, ElevenLabs pronounces the word 'comma'.
      // Replace the '.' with a hyphen to prevent this.
      .replace(/\b[\w|.]+(?=,)\b/g, match => match.replaceAll('.', '-'))

      // Remove any special characters that will never be pronounced properly such as "•" or "|"
      .replace(/[•|]/g, '')
  )
}
