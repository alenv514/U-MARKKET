import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface UseImageUploadOptions {
  bucket: 'listings' | 'avatars'
  maxFiles?: number
  maxSizeMB?: number
  initialUrls?: string[]
}

export function useImageUpload({
  bucket,
  maxFiles = 6,
  maxSizeMB = 5,
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

  const addFiles = useCallback((files: File[]) => {
    setError('')
    const currentTotal = existingUrls.length + newFiles.length
    const remaining = maxFiles - currentTotal
    
    if (remaining <= 0) return

    const toAdd = files.slice(0, remaining)
    
    // Validación de tamaño
    const maxBytes = maxSizeMB * 1024 * 1024
    const oversized = toAdd.filter(f => f.size > maxBytes)
    if (oversized.length > 0) {
      setError(`Las imágenes no deben superar los ${maxSizeMB}MB`)
      return
    }

    const previews = toAdd.map(f => URL.createObjectURL(f))
    
    setNewFiles(prev => [...prev, ...toAdd])
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
        const ext = file.name.split('.').pop()
        const filePath = `${user.id}/${Date.now()}-${i}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, { upsert: bucket === 'avatars' })

        if (uploadError) throw new Error(uploadError.message)

        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath)
        
        uploadedUrls.push(urlData.publicUrl)
        setProgress(Math.round(((i + 1) / newFiles.length) * 100))
      }

      setUploading(false)
      return [...existingUrls, ...uploadedUrls]
    } catch (err: any) {
      setError(err.message || 'Error al subir las imágenes')
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
