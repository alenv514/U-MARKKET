import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'U-Market UTA',
    short_name: 'U-Market',
    description: 'Marketplace exclusivo para estudiantes de la Universidad Técnica de Ambato.',
    start_url: '/',
    display: 'standalone',
    background_color: '#080b14',
    theme_color: '#6366f1',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      }
    ],
  }
}
