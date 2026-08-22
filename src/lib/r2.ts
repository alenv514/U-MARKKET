import { S3Client } from '@aws-sdk/client-s3'

const accountId = process.env.R2_ACCOUNT_ID || '76e7df87cb35995b27bcb4a2be2a17a3'
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '9cb42160c80b4253130f412ab208a13e'
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '593eae32be82e887558a09c4818f1792fbe89792c3c9b3492b1fa91e81611d0f'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
})

export const R2_BUCKET = process.env.R2_BUCKET_NAME || 'umarket-images'
export const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-d4d94f0e14b44bfeb3b54197cd3e967c.r2.dev'
