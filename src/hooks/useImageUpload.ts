import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/utils'

export interface UseImageUploadOptions {
  bucket: 'listings' | 'avatars'
  maxFiles?: number
  maxSizeMB?: number
  initialUrls?: string[]
}

export function useImageUpload({
  bucket,
  maxFiles = 6,
  maxSizeMB = 10,
  initialUrls = [],
}: UseImageUploadOptions) {
  const [existingUrls, setExistingUrls] = useState<string[]>(initialUrls)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const supabase = createClient()

  // Limpieza de URLs temporales al desmontar
  useEffect(() => {
    return () => {
      newPreviews.forEach(url => URL.revokeObjectURL(url))
    }
  }, [newPreviews])

  const addFiles = useCallback(async (files: File[]) => {
    setError('')
    const currentTotal = existingUrls.length + newFiles.length
    const remaining = maxFiles - currentTotal
    
    if (remaining <= 0) return

    const toAdd = files.slice(0, remaining)
    
    // Validación de tipo de archivo (Solo imágenes permitidas)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const invalidFormat = toAdd.filter(f => !validTypes.includes(f.type.toLowerCase()))
    if (invalidFormat.length > 0) {
      setError('Solo se permiten archivos de imagen válidos (JPG, PNG, WEBP, GIF)')
      return
    }

    // Compresión automática de imágenes anti-trolls
    const compressedFiles: File[] = await Promise.all(
      toAdd.map(file => compressImage(file, 1600, 1600, 0.82))
    )

    // Validación de tamaño máximo permitido (después de compresión)
    const maxBytes = maxSizeMB * 1024 * 1024
    const oversized = compressedFiles.filter(f => f.size > maxBytes)
    if (oversized.length > 0) {
      setError(`📸 La foto es demasiado pesada (supera los ${maxSizeMB}MB). Por favor, utiliza una app para bajar la resolución de la foto o comprimirla antes de subirla.`)
      return
    }

    const previews = compressedFiles.map(f => URL.createObjectURL(f))
    
    setNewFiles(prev => [...prev, ...compressedFiles])
    setNewPreviews(prev => [...prev, ...previews])
  }, [existingUrls.length, newFiles.length, maxFiles, maxSizeMB])

  const removeExisting = useCallback((index: number) => {
    setExistingUrls(prev => prev.filter((_, i) => i !== index))
  }, [])

  const removeNew = useCallback((index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index))
    setNewPreviews(prev => {
      URL.revokeObjectURL(prev[index]) // Evitar memory leak
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const upload = async (): Promise<string[] | null> => {
    setError('')
    setUploading(true)
    setProgress(0)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesión no encontrada')

      const uploadedUrls: string[] = []

      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', bucket)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()

        if (!res.ok || data.error) {
          throw new Error(data.error || 'Error al subir la imagen')
        }

        uploadedUrls.push(data.url)
        setProgress(Math.round(((i + 1) / newFiles.length) * 100))
      }

      setUploading(false)
      return [...existingUrls, ...uploadedUrls]
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes('exceeded') || msg.includes('large') || msg.includes('limit')) {
        setError('📸 La foto es demasiado pesada para el servidor. Por favor, utiliza una app para bajar la resolución de la foto o comprimirla.')
      } else {
        setError(msg || 'Error al subir las imágenes')
      }
      setUploading(false)
      return null
    }
  }

  return {
    existingUrls,
    newFiles,
    newPreviews,
    uploading,
    progress,
    error,
    addFiles,
    removeExisting,
    removeNew,
    setExistingUrls,
    upload
  }
}
