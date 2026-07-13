import Navbar from '@/components/Navbar'

export default function TerminosPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 64, minHeight: '100vh', paddingBottom: '4rem' }}>
        <div className="page-container" style={{ paddingTop: '3rem', maxWidth: 800 }}>
          <div className="glass-card" style={{ padding: '3rem 2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '2rem' }}>Términos y Condiciones</h1>
            
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <p>Bienvenido a U-Market. Al utilizar nuestra plataforma, aceptas los siguientes términos:</p>
              
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>1. Uso de la Plataforma</h2>
                <p>U-Market es un espacio exclusivo para estudiantes y personal de la Universidad Técnica de Ambato. Debes utilizar tu correo institucional (@uta.edu.ec) para registrarte. El uso de la cuenta es personal e intransferible.</p>
              </div>

              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>2. Publicaciones y Ventas</h2>
                <p>U-Market funciona únicamente como un intermediario tecnológico (catálogo). No procesamos pagos, no realizamos envíos y no nos hacemos responsables por la calidad, legalidad o seguridad de los productos o servicios ofrecidos por los usuarios vendedores.</p>
              </div>

              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>3. Comportamiento</h2>
                <p>Nos reservamos el derecho de eliminar cualquier publicación o suspender cuentas que infrinjan las normas de la universidad, publiquen contenido inapropiado, ilegal o reciban múltiples reportes de la comunidad.</p>
              </div>

              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>4. Suscripciones</h2>
                <p>El rol de Vendedor requiere una suscripción activa. Los pagos de suscripción no son reembolsables una vez activado el servicio.</p>
              </div>

              <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Última actualización: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
