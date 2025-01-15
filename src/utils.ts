import fs from 'fs/promises'

export async function writeToFile(filename: string, data: any) {
  console.log(`Writing to ${filename}`)
  await fs.writeFile(filename, JSON.stringify(data, null, 2))
}
