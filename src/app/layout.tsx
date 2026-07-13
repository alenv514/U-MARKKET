import type { Metadata, Viewport } from 'next'
import './globals.css'
import SplashCursor from '@/components/SplashCursor'

export const metadata: Metadata = {
  title: 'U-Market — Marketplace UTA',
  description: 'El marketplace oficial para estudiantes de la Universidad Técnica de Ambato. Compra, vende y conecta con tu comunidad universitaria.',
  keywords: 'marketplace, UTA, universidad, ambato, estudiantes, compra, venta',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'U-Market',
  },
  openGraph: {
    title: 'U-Market — Marketplace UTA',
    description: 'Compra y vende con estudiantes de la UTA',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#6366f1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <SplashCursor
          DENSITY_DISSIPATION={3.5}
          VELOCITY_DISSIPATION={2}
          SPLAT_RADIUS={0.25}
          SPLAT_FORCE={6000}
          CURL={3}
          RAINBOW_MODE={true}
          SHADING={true}
        />
        {children}
      </body>
    </html>
  )
}
