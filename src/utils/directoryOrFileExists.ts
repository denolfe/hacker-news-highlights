import fs from 'fs/promises'

export async function directoryOrFileExists(dirPath: string): Promise<boolean> {
  try {
    await fs.access(dirPath)
    return true
  } catch {
    return false
  }
}
