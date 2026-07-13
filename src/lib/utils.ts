/** Elimina tags HTML para prevenir XSS almacenado. */
export function sanitize(val: string): string {
  return val.replace(/<[^>]*>/g, '').trim()
}

/** Valida precio: número finito, >= 0, <= 100_000. */
export function isValidPrice(val: string): boolean {
  const n = Number(val)
  return val.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100_000
}

/** Valida formato teléfono Ecuador: +593XXXXXXXXX o 09XXXXXXXX */
export function isValidEcuadorPhone(val: string): boolean {
  return /^(\+593|0)?9\d{8}$/.test(val.trim())
}

const BANNED_WORDS = [
  'marihuana', 'cocaina', 'cocaína', 'droga', 'drogas', 'weed', 'extasis', 'éxtasis', 'lsd', 'perico',
  'arma', 'armas', 'pistola', 'revólver', 'revolver', 'navaja', 'cuchillo', 'balas', 'municion', 'munición',
  'sexo', 'porno', 'pornografia', 'pornografía', 'erotico', 'erótico', 'consolador', 'vibrador', 'servicios sexuales',
  'prepago', 'prostituta', 'scort', 'escort', 'pack', 'packs',
  'hackear', 'hacker', 'resolver examen', 'hacer examen', 'suplantar'
]

/** Analiza un texto y devuelve si contiene palabras prohibidas. */
export function checkBannedWords(text: string): { hasBanned: boolean; word?: string } {
  if (!text) return { hasBanned: false }
  
  const cleanText = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  
  for (const word of BANNED_WORDS) {
    const cleanWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (cleanText.includes(cleanWord)) {
      return { hasBanned: true, word }
    }
  }
  
  return { hasBanned: false }
}
