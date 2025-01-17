import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import { CACHE_DIR } from '../lib/constants'
import { log } from './log'

export function joinAudioFiles(filenames: string[], output: string): Promise<void> {
  log.info(`Merging ${filenames.length} audio files into ${output}...`)
  return new Promise((resolve, reject) => {
    const command = ffmpeg()

    filenames
      .map(f => path.resolve(CACHE_DIR, f))
      .forEach(file => {
        command.input(file)
      })

    command
      .on('end', () => {
        log.info('Audio files merged successfully!')
        resolve()
      })
      .on('error', err => {
        console.error('Error occurred:', err)
        reject(err)
      })
      .mergeToFile(output, path.dirname(output))
  })
}
