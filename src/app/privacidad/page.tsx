import Navbar from '@/components/Navbar'

export default function PrivacidadPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 64, minHeight: '100vh', paddingBottom: '4rem' }}>
        <div className="page-container" style={{ paddingTop: '3rem', maxWidth: 800 }}>
          <div className="glass-card" style={{ padding: '3rem 2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '2rem' }}>Políticas de Privacidad</h1>
            
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <p>Tu privacidad es importante para nosotros. En esta política explicamos qué datos recopilamos y cómo los utilizamos (Cumplimiento GDPR/LOPD).</p>
              
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>1. Datos Recopilados</h2>
                <p>Al registrarte, almacenamos tu correo electrónico institucional, nombre completo y (opcionalmente) tu número de WhatsApp y foto de perfil. Si publicas productos, almacenamos los datos de dichas publicaciones e imágenes.</p>
              </div>

              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>2. Uso de la Información</h2>
                <p>Utilizamos tus datos exclusivamente para el funcionamiento de la plataforma: autenticación, visualización de tu perfil a otros usuarios (para concretar ventas) y administración interna de U-Market. No compartimos ni vendemos tu información a terceros.</p>
              </div>

              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>3. Derechos del Usuario (Eliminación de Cuenta)</h2>
                <p>Tienes el derecho absoluto a acceder, modificar o eliminar tu información. Puedes eliminar tu cuenta de forma permanente en cualquier momento desde tu panel de "Mi Perfil". Esto borrará tus datos, publicaciones e imágenes de nuestros servidores de forma irreversible.</p>
              </div>

              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>4. Seguridad</h2>
                <p>Tus datos están protegidos por la infraestructura de seguridad de Supabase y encriptación en tránsito (HTTPS). Las contraseñas no son legibles por nosotros.</p>
              </div>

              <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Última actualización: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
