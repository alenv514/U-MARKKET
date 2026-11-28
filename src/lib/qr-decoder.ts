import jsQR from 'jsqr'

function tryDecodeRegion(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dw: number,
  dh: number
): string | null {
  ctx.canvas.width = dw
  ctx.canvas.height = dh
  ctx.clearRect(0, 0, dw, dh)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh)
  const imageData = ctx.getImageData(0, 0, dw, dh)
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  })
  return result?.data?.trim() || null
}

/**
 * Decodifica el código QR de una captura o fotografía de credencial UTA en el navegador.
 * Prueba múltiples escalas y el área inferior del carnet para mejorar fiabilidad en móviles.
 */
export async function decodeQrFromImageFile(file: File): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('No se pudo cargar la imagen'))
      el.src = objectUrl
    })

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null

    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    if (!w || !h) return null

    // 1. Intento a resolución natural (limitada a 1800px para no saturar memoria móvil)
    const maxDim = 1800
    const scale = Math.max(w, h) > maxDim ? maxDim / Math.max(w, h) : 1
    const fullW = Math.max(1, Math.round(w * scale))
    const fullH = Math.max(1, Math.round(h * scale))

    const pass1 = tryDecodeRegion(ctx, img, 0, 0, w, h, fullW, fullH)
    if (pass1) return pass1

    // 2. Si era muy grande y se redujo, intentar resolución nativa completa
    if (scale < 1) {
      const passNative = tryDecodeRegion(ctx, img, 0, 0, w, h, w, h)
      if (passNative) return passNative
    }

    // 3. Recorte de la mitad inferior (donde aparece el QR en Credenciales UTA)
    const cropY = Math.floor(h * 0.4)
    const cropH = h - cropY
    const cropScale = cropH > 1000 ? 1000 / cropH : 1
    const passBottom = tryDecodeRegion(
      ctx,
      img,
      0,
      cropY,
      w,
      cropH,
      Math.max(1, Math.round(w * cropScale)),
      Math.max(1, Math.round(cropH * cropScale))
    )
    if (passBottom) return passBottom

    return null
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** Escanea un frame actual de <video> buscando un código QR. */
export function decodeQrFromVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): string | null {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return null
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  const maxDim = 960
  const scale = Math.max(video.videoWidth, video.videoHeight) > maxDim
    ? maxDim / Math.max(video.videoWidth, video.videoHeight)
    : 1

  const width = Math.max(1, Math.round(video.videoWidth * scale))
  const height = Math.max(1, Math.round(video.videoHeight * scale))
  return tryDecodeRegion(ctx, video, 0, 0, video.videoWidth, video.videoHeight, width, height)
}
