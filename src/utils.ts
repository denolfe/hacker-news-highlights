import fs from 'fs/promises'

export async function writeToFile(filename: string, data: any) {
  console.log(`Writing to ${filename}`)
  if (filename.endsWith('.json')) {
    await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf-8')
  } else {
    await fs.writeFile(filename, data, 'utf-8')
  }
}
