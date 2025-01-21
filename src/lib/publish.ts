import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import fs from 'fs/promises'

import { log } from '../utils/log'
import { EPISODE_OUTPUT } from './constants'

async function publishEpisode(key: string) {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })

  const episodeBuffer = await fs.readFile(EPISODE_OUTPUT)

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: episodeBuffer,
  })

  const response = await client.send(command)
  log.info({ response })

  if (response.$metadata.httpStatusCode !== 200) {
    throw new Error('Failed to upload episode')
  }
}
