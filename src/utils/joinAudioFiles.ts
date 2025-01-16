import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import { DATA_DIR } from '../constants'

export function joinAudioFiles(filenames: string[], output: string): Promise<void> {
  console.log(`Merging ${filenames.length} audio files into ${output}...`)
  return new Promise((resolve, reject) => {
    const command = ffmpeg()

    filenames
      .map(f => path.resolve(DATA_DIR, f))
      .forEach(file => {
        command.input(file)
      })

    command
      .on('end', () => {
        console.log('Audio files merged successfully!')
        resolve()
      })
      .on('error', err => {
        console.error('Error occurred:', err)
        reject(err)
      })
      .mergeToFile(output, path.dirname(output))
  })
}
