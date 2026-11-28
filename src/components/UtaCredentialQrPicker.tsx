'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import { decodeQrFromImageFile, decodeQrFromVideoFrame } from '@/lib/qr-decoder'

interface UtaCredentialQrPickerProps {
  onQrDecoded: (qrUrl: string, file?: File) => Promise<void>
  onFileWithoutQr?: (file: File) => void
  verifiedSummary?: {
    officialName: string
    academicPeriod: string | null
  } | null
  onResetVerified?: () => void
  busy?: boolean
  error?: string | null
  onClearError?: () => void
  title?: string
  subtitle?: string
}

const VALID_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_FILE_BYTES = 8 * 1024 * 1024

export default function UtaCredentialQrPicker({
  onQrDecoded,
  onFileWithoutQr,
  verifiedSummary,
  onResetVerified,
  busy = false,
  error,
  onClearError,
  title = 'Credencial Digital UTA (Código QR)',
  subtitle = 'Sube una captura de tu carnet universitario o escanea el código QR con la cámara.',
}: UtaCredentialQrPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const resolvingCameraRef = useRef(false)

  const [scanningFile, setScanningFile] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [localError, setLocalError] = useState('')

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    resolvingCameraRef.current = false
    setCameraOpen(false)
  }, [])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return

    const video = videoRef.current
    video.srcObject = streamRef.current
    video.play().catch(() => {})

    const timer = window.setInterval(async () => {
      if (resolvingCameraRef.current || !videoRef.current || !canvasRef.current) return
      const qrData = decodeQrFromVideoFrame(videoRef.current, canvasRef.current)
      if (!qrData) return

      resolvingCameraRef.current = true
      stopCamera()
      try {
        await onQrDecoded(qrData)
      } finally {
        resolvingCameraRef.current = false
      }
    }, 240)

    return () => {
      window.clearInterval(timer)
    }
  }, [cameraOpen, onQrDecoded, stopCamera])

  const handleOpenCamera = async () => {
    setLocalError('')
    onClearError?.()
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setLocalError('Tu navegador no permite abrir la cámara. Sube una captura de tu credencial UTA.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setCameraOpen(true)
    } catch {
      setLocalError('No pudimos acceder a la cámara. Verifica los permisos o sube la captura del carnet.')
    }
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setLocalError('')
    onClearError?.()

    if (!VALID_MIME_TYPES.has(file.type.toLowerCase())) {
      setLocalError('Formato no válido. Sube una captura en formato JPG, PNG o WEBP.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setLocalError('La imagen es demasiado pesada (máximo 8MB).')
      return
    }

    setScanningFile(true)
    try {
      const qrUrl = await decodeQrFromImageFile(file)
      if (qrUrl) {
        await onQrDecoded(qrUrl, file)
      } else if (onFileWithoutQr) {
        onFileWithoutQr(file)
      } else {
        setLocalError(
          'No se encontró un código QR legible en esta imagen. Sube la captura completa de Credenciales UTA o usa la cámara.'
        )
      }
    } catch {
      setLocalError('No se pudo procesar la imagen seleccionada. Intenta con otra captura.')
    } finally {
      setScanningFile(false)
    }
  }

  const isBusy = busy || scanningFile
  const displayError = error || localError

  if (verifiedSummary) {
    return (
      <div
        style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 14,
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 800, color: '#00345e' }}>
            <Icon name="checkCircle" size={16} /> Credencial UTA validada
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              background: '#00345e',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            LEGALMENTE MATRICULADO
          </span>
        </div>

        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
          {verifiedSummary.officialName}
        </div>

        {verifiedSummary.academicPeriod && (
          <div style={{ fontSize: '0.76rem', color: '#334155' }}>
            Periodo vigente: <strong>{verifiedSummary.academicPeriod}</strong>
          </div>
        )}

        {onResetVerified && (
          <div>
            <button
              type="button"
              onClick={onResetVerified}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                color: '#00345e',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Usar otra credencial
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: 14,
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.85rem', fontWeight: 800, color: '#00345e' }}>
          <Icon name="qrCode" size={16} /> {title}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: '#475569', lineHeight: 1.45 }}>
          {subtitle}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {cameraOpen ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              maxHeight: 260,
              borderRadius: 12,
              border: '2px solid #00345e',
              background: '#0f172a',
              objectFit: 'cover',
            }}
          />
          <p style={{ fontSize: '0.76rem', color: '#334155', margin: 0, textAlign: 'center' }}>
            Enfoca el código QR de la app <strong>Credenciales UTA</strong>. Se leerá automáticamente.
          </p>
          <button
            type="button"
            onClick={stopCamera}
            className="btn-secondary"
            style={{ padding: '0.45rem 1rem', fontSize: '0.78rem' }}
          >
            Detener cámara
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary"
            style={{
              flex: '1 1 180px',
              padding: '0.65rem 0.9rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#00345e',
              borderColor: 'rgba(0, 52, 94, 0.35)',
              background: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {isBusy ? (
              <>
                <span
                  className="animate-spin"
                  style={{
                    width: 14,
                    height: 14,
                    border: '2px solid #00345e',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    display: 'inline-block',
                  }}
                />
                Validando QR en UTA...
              </>
            ) : (
              <>
                <Icon name="image" size={15} /> Subir captura del carnet
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleOpenCamera}
            className="btn-secondary"
            style={{
              flex: '1 1 150px',
              padding: '0.65rem 0.9rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#0f172a',
              background: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Icon name="camera" size={15} /> Escanear QR
          </button>
        </div>
      )}

      {displayError && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: '0.6rem 0.8rem',
            fontSize: '0.78rem',
            color: '#b91c1c',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            lineHeight: 1.4,
          }}
        >
          <Icon name="alert" size={14} style={{ marginTop: 2 }} />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  )
}
