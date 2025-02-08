import fs from 'fs/promises'

import { log } from './log.js'

type WritableData = Parameters<typeof fs.writeFile>[1]

export async function writeToFile(filename: string, data: WritableData) {
  log.info(`Writing to ${filename}`)
  if (filename.endsWith('.json')) {
    await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf-8')
  } else {
    await fs.writeFile(filename, data, 'utf-8')
  }
}
