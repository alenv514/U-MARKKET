import { createHmac, timingSafeEqual } from 'node:crypto'
import { QR_AUTH_EMAIL_DOMAIN } from '@/lib/utils'

const ALLOWED_UTA_HOST = 'verificarcarnet.uta.edu.ec'
const ALLOWED_QR_PARAMS = new Set(['identificacion_fun', 'identificacion'])
const QR_TOKEN_TTL_MS = 20 * 60 * 1000

export interface ParsedUtaCarnet {
  identificacion: string
  officialName: string
  statusText: string
  academicPeriod: string | null
  isMatriculado: boolean
}

export interface UtaQrVerificationResult {
  valid: boolean
  identificacion?: string
  cedulaHash?: string
  officialName?: string
  statusText?: string
  academicPeriod?: string | null
  error?: string
}

export interface QrTokenPayload {
  cedulaHash: string
  officialName: string
  academicPeriod: string | null
  iat: number
  exp: number
}

function getBaseSecret(): string {
  const secret = process.env.CEDULA_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error('Falta CEDULA_HASH_SECRET o SUPABASE_SERVICE_ROLE_KEY en el servidor')
  }
  return secret
}

function getDerivedKey(purpose: 'uta-cedula-hmac-v1' | 'uta-qr-token-v1'): Buffer {
  return createHmac('sha256', getBaseSecret()).update(purpose).digest()
}

function normalizeAsciiUpper(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtmlText(raw: string): string {
  const withoutTags = raw.replace(/<[^>]+>/g, ' ')
  return withoutTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&Aacute;/gi, 'Á')
    .replace(/&Eacute;/gi, 'É')
    .replace(/&Iacute;/gi, 'Í')
    .replace(/&Oacute;/gi, 'Ó')
    .replace(/&Uacute;/gi, 'Ú')
    .replace(/&Ntilde;/gi, 'Ñ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim()
}

/** Valida estrictamente que la URL provenga del portal oficial verificarcarnet.uta.edu.ec (anti-SSRF). */
export function validateAndNormalizeUtaQrUrl(rawUrl: string): URL | null {
  if (typeof rawUrl !== 'string') return null
  const trimmed = rawUrl.trim()
  if (!trimmed || trimmed.length > 1024) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:') return null
    if (parsed.hostname.toLowerCase() !== ALLOWED_UTA_HOST) return null
    if (parsed.username || parsed.password || parsed.port) return null
    if (parsed.pathname !== '/' && parsed.pathname !== '') return null

    const entries = Array.from(parsed.searchParams.entries())
    if (entries.length !== 1) return null

    const [paramName, paramValue] = entries[0]
    if (!ALLOWED_QR_PARAMS.has(paramName)) return null
    if (!/^[A-Za-z0-9_-]{6,256}$/.test(paramValue)) return null

    const cleanUrl = new URL(`https://${ALLOWED_UTA_HOST}/`)
    cleanUrl.searchParams.set(paramName, paramValue)
    return cleanUrl
  } catch {
    return null
  }
}

/** Calcula HMAC-SHA256 irreversible de la cédula para prevenir duplicados sin almacenar PII. */
export function computeCedulaHash(identificacion: string): string {
  const normalized = identificacion.trim().toUpperCase()
  return createHmac('sha256', getDerivedKey('uta-cedula-hmac-v1'))
    .update(`uta:id:${normalized}`)
    .digest('hex')
}

/** Extrae identificación, nombres y estado desde el HTML oficial de verificarcarnet.uta.edu.ec. */
export function parseUtaCarnetHtml(html: string): ParsedUtaCarnet | null {
  if (!html || typeof html !== 'string') return null

  const normalizedPage = normalizeAsciiUpper(decodeHtmlText(html))
  if (normalizedPage.includes('NO EXISTE INFORMACION EN LA BASE DE DATOS')) {
    return null
  }

  let identificacion = ''
  let officialName = ''
  let statusText = ''

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi

  for (const rowMatch of html.matchAll(rowRegex)) {
    const cells = Array.from(rowMatch[1].matchAll(cellRegex), (m) => decodeHtmlText(m[1]))
    if (cells.length < 2) continue

    const label = normalizeAsciiUpper(cells[0]).replace(/:$/, '')
    const value = cells[1]
    if (!value) continue

    if (label.startsWith('IDENTIFICACION')) {
      identificacion = value.replace(/\s+/g, '')
    } else if (label.startsWith('NOMBRES')) {
      officialName = value
    } else if (label.startsWith('ESTADO')) {
      statusText = value
    }
  }

  if (!identificacion || !/^[A-Za-z0-9-]{6,20}$/.test(identificacion)) {
    return null
  }
  if (!officialName || officialName.length < 3) {
    return null
  }

  const normalizedStatus = normalizeAsciiUpper(statusText)
  const isMatriculado = normalizedStatus.includes('LEGALMENTE MATRICULADO')
  const periodMatch = statusText.match(/periodo\s+acad[eé]mico\s+(.+?)\s+en\s+la\s+Universidad/i)
  const academicPeriod = periodMatch?.[1]?.trim() || null

  return {
    identificacion,
    officialName,
    statusText,
    academicPeriod,
    isMatriculado,
  }
}

/** Consulta el portal oficial de la UTA y valida si la credencial pertenece a un estudiante matriculado. */
export async function verifyUtaCarnetByQrUrl(rawUrl: string): Promise<UtaQrVerificationResult> {
  const cleanUrl = validateAndNormalizeUtaQrUrl(rawUrl)
  if (!cleanUrl) {
    return {
      valid: false,
      error: 'El código QR no pertenece a la credencial oficial de la UTA (verificarcarnet.uta.edu.ec).',
    }
  }

  let html: string
  try {
    const response = await fetch(cleanUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'U-Market-UTA-Verifier/1.0',
      },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
    })

    if (response.status !== 200) {
      return {
        valid: false,
        error: 'El portal oficial de verificación de la UTA no respondió correctamente. Intenta de nuevo.',
      }
    }

    html = await response.text()
  } catch {
    return {
      valid: false,
      error: 'No se pudo conectar con verificarcarnet.uta.edu.ec. Intenta de nuevo en unos momentos.',
    }
  }

  const parsed = parseUtaCarnetHtml(html)
  if (!parsed) {
    return {
      valid: false,
      error: 'La UTA no encontró un carnet estudiantil válido para este código QR.',
    }
  }

  if (!parsed.isMatriculado) {
    return {
      valid: false,
      error: 'La credencial no figura como "LEGALMENTE MATRICULADO" en el periodo académico vigente de la UTA.',
    }
  }

  return {
    valid: true,
    identificacion: parsed.identificacion,
    cedulaHash: computeCedulaHash(parsed.identificacion),
    officialName: parsed.officialName,
    statusText: parsed.statusText,
    academicPeriod: parsed.academicPeriod,
  }
}

/** Construye un correo técnico interno determinístico en Auth para cuentas con usuario cédula/QR. */
export function buildQrSyntheticAuthEmail(cedulaHash: string): string {
  return `u-${cedulaHash.slice(0, 28)}${QR_AUTH_EMAIL_DOMAIN}`
}

/** Firma un token temporal para vincular una validación QR ya verificada al envío del registro. */
export function signQrVerificationToken(data: {
  cedulaHash: string
  officialName: string
  academicPeriod: string | null
}): string {
  const iat = Date.now()
  const payload: QrTokenPayload = {
    cedulaHash: data.cedulaHash,
    officialName: data.officialName,
    academicPeriod: data.academicPeriod,
    iat,
    exp: iat + QR_TOKEN_TTL_MS,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', getDerivedKey('uta-qr-token-v1'))
    .update(encodedPayload)
    .digest('base64url')
  return `${encodedPayload}.${signature}`
}

/** Verifica integridad y vigencia de un token QR firmado por el servidor. */
export function verifyQrVerificationToken(token: string): QrTokenPayload | null {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [encodedPayload, providedSig] = parts
  if (!encodedPayload || !providedSig) return null

  const expectedSig = createHmac('sha256', getDerivedKey('uta-qr-token-v1'))
    .update(encodedPayload)
    .digest('base64url')

  const a = Buffer.from(providedSig, 'utf8')
  const b = Buffer.from(expectedSig, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as QrTokenPayload
    if (
      !parsed ||
      typeof parsed.cedulaHash !== 'string' ||
      typeof parsed.officialName !== 'string' ||
      typeof parsed.exp !== 'number' ||
      Date.now() > parsed.exp
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const NAME_STOPWORDS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y'])

/** Comprueba coincidencia razonable de nombres entre perfil existente y registro oficial UTA. */
export function doStudentNamesMatch(profileName: string, officialName: string): boolean {
  const extractTokens = (value: string) =>
    normalizeAsciiUpper(value)
      .replace(/[^A-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !NAME_STOPWORDS.has(t))

  const entered = extractTokens(profileName)
  if (entered.length === 0) return true

  const official = new Set(extractTokens(officialName))
  if (official.size === 0) return false

  let matches = 0
  for (const token of entered) {
    if (official.has(token)) matches++
  }

  const requiredMatches = entered.length === 1 ? 1 : 2
  return matches >= requiredMatches
}
