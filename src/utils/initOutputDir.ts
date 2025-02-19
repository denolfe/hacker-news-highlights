import { OUTPUT_DIR } from '@/constants.js'
import fs from 'fs/promises'

import { directoryOrFileExists } from './directoryOrFileExists.js'

export async function initOutputDir() {
  if (!(await directoryOrFileExists(OUTPUT_DIR))) {
    await fs.mkdir(OUTPUT_DIR)
  }
}
