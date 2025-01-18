import fs from 'fs/promises'
import { OUTPUT_DIR } from '../lib/constants'
import { directoryOrFileExists } from './directoryOrFileExists'

export async function initOutputDir() {
  if (!(await directoryOrFileExists(OUTPUT_DIR))) {
    await fs.mkdir(OUTPUT_DIR)
  }
}
