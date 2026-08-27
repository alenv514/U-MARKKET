/** Elimina tags HTML y atributos maliciosos para prevenir XSS almacenado. */
export function sanitize(val: string): string {
  if (!val) return ''
  return val
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
}

/** Escapa caracteres especiales para interpolación segura en templates HTML. */
export function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
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

/** Comprime y redimensiona una imagen en el cliente para reducir peso y optimizar espacio. */
export async function compressImage(file: File, maxWidth = 1600, maxHeight = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxHeight) / width)
            width = maxWidth
          } else {
            width = Math.round((width * maxWidth) / height)
            height = maxHeight
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(file)

        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file)
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => resolve(file)
    }
    reader.onerror = () => resolve(file)
  })
}

/**
 * Detecta si una imagen contiene al menos un rostro humano.
 * Usa la API nativa FaceDetector (Chrome/Edge/Android) sin dependencias externas.
 * NOTA: Si el navegador no soporta FaceDetector (ej. Safari/Firefox), se aplica fallback
 * permisivo para no bloquear el registro de usuarios en dichos navegadores.
 * Retorna { hasFace: boolean, supported: boolean }
 */
export async function detectFace(file: File): Promise<{ hasFace: boolean; supported: boolean }> {
  // Verificar soporte del navegador
  if (typeof window === 'undefined' || !('FaceDetector' in window)) {
    return { hasFace: true, supported: false } // Fallback permisivo
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = async (event) => {
      try {
        const img = new Image()
        img.src = event.target?.result as string
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej })

        // Crear bitmap desde la imagen
        const bitmap = await createImageBitmap(img)
        const FaceDetectorClass = (window as unknown as { FaceDetector: new (opts: { fastMode: boolean; maxDetectedFaces: number }) => { detect: (bm: ImageBitmap) => Promise<unknown[]> } }).FaceDetector
        const detector = new FaceDetectorClass({ fastMode: true, maxDetectedFaces: 1 })
        const faces = await detector.detect(bitmap)
        bitmap.close()

        resolve({ hasFace: faces.length > 0, supported: true })
      } catch {
        // Si falla por cualquier razón, permitir la subida
        resolve({ hasFace: true, supported: false })
      }
    }
    reader.onerror = () => resolve({ hasFace: true, supported: false })
  })
}

