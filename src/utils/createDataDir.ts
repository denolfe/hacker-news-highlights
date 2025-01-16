import fs from 'fs/promises'
import { directoryOrFileExists } from './directoryOrFileExists'
import { DATA_DIR } from '../lib/constants'

export async function createDataDir() {
  if (!(await directoryOrFileExists(DATA_DIR))) {
    await fs.mkdir(DATA_DIR)
  }
}
