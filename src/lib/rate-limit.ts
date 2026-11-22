/**
 * Rate limiter simple en memoria (por proceso). En un despliegue serverless
 * cada instancia mantiene su propio estado, por lo que no debe usarse como
 * control definitivo; es una primera línea de defensa.
 */
export interface RateLimitState {
  count: number
  resetAt: number
}

export function createRateLimiter(limit: number, windowMs: number) {
  const store = new Map<string, RateLimitState>()

  return function isLimited(key: string): boolean {
    const now = Date.now()

    if (store.size > 500) {
      for (const [k, v] of store.entries()) {
        if (now > v.resetAt) store.delete(k)
      }
    }

    const entry = store.get(key)

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs })
      return false
    }

    if (entry.count >= limit) return true
    entry.count++
    return false
  }
}