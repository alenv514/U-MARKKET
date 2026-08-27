import { S3Client } from '@aws-sdk/client-s3'

const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

if (!accountId || !accessKeyId || !secretAccessKey) {
  // En desarrollo o build, si faltan variables no romper la compilación a menos que se intente usar
  console.warn('⚠️ Variables de Cloudflare R2 faltantes en las variables de entorno.')
}

export const r2 = new S3Client({
  region: 'auto',
  endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : 'https://dummy.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || '',
  },
})

export const R2_BUCKET = process.env.R2_BUCKET_NAME || 'umarket-images'
export const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''
