/**
 * TTS has issues with specific terms and patterns. This function replaces them with phonetic alternatives.
 */
export function adjustPronunciation(text: string): string {
  return (
    text
      // Prevent pronouncing dashes in URLs
      .replace(/(?<=Source: )\S+\b/g, source => source.replace(/-/g, ' '))

      // Add any pronunciation replacements here
      .replace(/\bgui\b/gi, 'gooey')
      .replace(/\bgzip\b/gi, 'jee-zip')
      .replace(/\bpostgresql\b/gi, 'postgressQL')
      .replace(/\bregex\b/gi, 'rehjex')
      .replace(/\browid\b/gi, 'row ID')
      .replace(/\bsql\b/gi, 'sequel')
      .replace(/\bsqlite\b/gi, 'ess-cue-lite')
      .replace(/\bwasm\b/gi, 'wazum')
      .replace(/\bmemecoin\b/gi, 'meme-coin')
      .replace(/\bvram\b/gi, 'vee-ram')
      .replace(/\bcodegen\b/gi, 'code-gen')
      .replace(/\bbluesky\b/gi, 'blue-sky')
      .replace(/\bgnu\b/gi, 'guh-new')
      .replace(/\bffmpeg\b/gi, 'eff-eff-empeg')
      .replace(/\bC#/gi, 'C-Sharp')
      .replace(/\bF#/gi, 'F-Sharp')
      .replace(/\bredis\b/gi, 'red-iss')
      .replace(/\bsystemd\b/gi, 'system D')
      .replace(/\bnas\b/gi, 'nazz')
      .replace(/\bfreenas\b/gi, 'freenazz')
      .replace(/\bnginx\b/gi, 'engine-X')
      .replace(/\bocaml\b/gi, 'O-Camel')
      .replace(/\bwysiwyg\b/gi, 'wizzy-wig')
      .replace(/\bascii\b/gi, 'askee')

      // Grok
      .replace(/\bgrok\b/gi, 'grock')
      .replace(/\bgrok(\d)\b/gi, 'grock $1')

      /**
       * For words with a '.' followed by a comma, ElevenLabs pronounces the word 'comma'.
       **/

      // Common tlds domains - replace ',' with '-dot-'
      .replace(
        // eslint-disable-next-line regexp/no-unused-capturing-group
        /\b\w*\.(com|org|net|io|dev|app|gg|tech|online|store|shop|blog|website|page|space|site|design|art|info|xyz|club|live|news|today|world|zone|center|company|global|group|international|life|systems|works|codes|email|media|solutions|studio|academy|agency|business|careers|digital|education|events|exchange|expert|guru|institute|marketing|partners|services|support|tools|training|ventures)(?=,)/g,
        match => match.replaceAll('.', '-dot-'),
      )

      // Words ending in '.js' to pronunce acronym JS, common for frameworks and libraries
      .replace(/\b(\w+)\.js\b/gi, (_, p1) => {
        return p1 + ' JS'
      })

      // Words ending in '.sh' to be pronounced "dot SH", common for frameworks and libraries
      .replace(/\b(\w+)\.sh\b/gi, (_, p1) => {
        return p1 + ' dot SH'
      })

      // Replace abbreviations followed by apostrophe or comma with hyphen ie. U.S.'s -> U-S's or U.S., -> U-S,
      .replace(/\b([A-Z](?:\.[A-Z])+)\.('s|,)/g, (_, p1, p2) => {
        return p1.replace(/\./g, '-') + p2
      })

      // Insert a space in words that end with an acronym. Ex. "OpenAI" -> "Open AI", "macOS" -> "mac OS"
      .replace(/\b([a-z]+(?:[A-Z][a-z]+)?|[A-Z][a-z]+)([A-Z]{2,})\b/g, (_, p1, p2) => {
        return p1 + ' ' + p2
      })

      // Replace the '.' with '-'
      .replace(/\b\w[\w|.]+(?=,)\b/g, match => match.replaceAll('.', '-'))

      // Remove any special characters that will never be pronounced properly such as "•" or "|"
      .replace(/[•|]/g, '')
  )
}
