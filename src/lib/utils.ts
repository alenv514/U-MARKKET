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
