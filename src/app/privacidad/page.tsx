import Navbar from '@/components/Navbar'
import Link from 'next/link'

export default function PrivacidadPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 64, minHeight: '100vh', paddingBottom: '4rem', background: '#070a12' }}>
        <div className="page-container" style={{ paddingTop: '3rem', maxWidth: 840 }}>
          <div 
            className="glass-card animate-fade-in" 
            style={{ 
              padding: '3rem 2.5rem', 
              borderRadius: 24, 
              background: 'rgba(13, 18, 30, 0.4)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              color: 'rgba(255, 255, 255, 0.6)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem' }}>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: 'rgba(99, 102, 241, 0.8)',
                background: 'rgba(99, 102, 241, 0.08)',
                padding: '4px 10px',
                borderRadius: 20,
                border: '1px solid rgba(99, 102, 241, 0.15)',
                display: 'inline-block',
                marginBottom: 12
              }}>
                Marco Legal & Protección LOPDP
              </span>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.4rem' }}>
                Política de Privacidad y Tratamiento de Datos Personales
              </h1>
              <p style={{ color: 'rgba(255, 255, 255, 0.35)', fontSize: '0.8rem' }}>
                Conformidad con la Ley Orgánica de Protección de Datos Personales (Ecuador)
              </p>
            </div>
            
            <div style={{ lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: '1.75rem', fontSize: '0.9rem' }}>
              
              <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                En <strong style={{ color: 'rgba(255, 255, 255, 0.9)' }}>U-Market</strong> la protección y confidencialidad de los datos de la comunidad universitaria es nuestra máxima prioridad. La presente política detalla las condiciones bajo las cuales autorizas el tratamiento de tu información personal.
              </p>

              {/* 1. Responsable */}
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(165, 180, 252, 0.9)', marginBottom: '0.4rem' }}>
                  1. Responsable del Tratamiento
                </h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.55)' }}>
                  El responsable del tratamiento de los datos en la plataforma U-Market es su desarrollador y titular, Alen Lenin Villamarín Velasco, con correo de contacto y soporte: <code style={{ color: '#a5b4fc' }}>avillamarin8139@uta.edu.ec</code>.
                </p>
              </div>

              {/* 2. Base Legal y Consentimiento */}
              <div style={{
                background: 'rgba(99, 102, 241, 0.04)',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                padding: '1.25rem 1.5rem',
                borderRadius: 16
              }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(165, 180, 252, 0.9)', marginBottom: '0.5rem' }}>
                  2. Base Legal y Autorización del Titular
                </h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.65)', margin: 0 }}>
                  El tratamiento de datos se fundamenta en el <strong>consentimiento expreso e informado</strong> otorgado por el usuario al marcar la casilla de verificación en el formulario de registro, en apego a los artículos 7 y 8 de la Ley Orgánica de Protección de Datos Personales (LOPDP) del Ecuador.
                </p>
              </div>

              {/* 3. Datos recopilados */}
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.75)', marginBottom: '0.4rem' }}>
                  3. Categorías de Datos Recopilados
                </h2>
                <ul style={{ paddingLeft: '1.25rem', color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.85rem' }}>
                  <li><strong>Datos de Identificación y Contacto:</strong> Nombre completo, correo electrónico institucional (<code>@uta.edu.ec</code>), número de teléfono/WhatsApp (opcional) y avatar o foto de perfil.</li>
                  <li><strong>Datos Académicos:</strong> Facultad, carrera universitaria y semestre en curso para verificar tu condición estudiantil.</li>
                  <li><strong>Datos de Actividad Comercial:</strong> Títulos, descripciones, categorías, precios y fotografías de los productos o servicios que decidas publicar.</li>
                  <li><strong>Mensajes:</strong> Comunicaciones internas enviadas a través del chat de la plataforma con fines exclusivos de coordinación de compraventa.</li>
                </ul>
              </div>

              {/* 4. Finalidad */}
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.75)', marginBottom: '0.4rem' }}>
                  4. Finalidad del Tratamiento de Datos
                </h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.55)', marginBottom: '0.5rem' }}>
                  Tus datos son tratados exclusivamente para:
                </p>
                <ol style={{ paddingLeft: '1.25rem', color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.85rem' }}>
                  <li>Validar tu pertenencia a la Universidad Técnica de Ambato y prevenir accesos no autorizados.</li>
                  <li>Permitir que compradores y vendedores se contacten de forma segura y transparente.</li>
                  <li>Monitorear la seguridad comunitaria y prevenir fraudes, estafas o publicaciones ilícitas.</li>
                  <li>Generar estadísticas institucionales anonimizadas sobre emprendimiento y comercio estudiantil.</li>
                </ol>
                <p style={{ color: '#a5b4fc', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.5rem' }}>
                  🛡️ Principio de No Comercialización: U-Market NO vende, NO alquila ni comparte tus datos personales con terceros con fines publicitarios o comerciales ajenos a la plataforma.
                </p>
              </div>

              {/* 5. Derechos ARCO */}
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.75)', marginBottom: '0.4rem' }}>
                  5. Derechos del Usuario y Eliminación Permanente de Cuenta (GDPR / LOPDP)
                </h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.55)' }}>
                  Como titular de los datos, tienes derecho al acceso, rectificación, actualización y supresión de tu información. Puedes editar tus datos desde la sección <em>&quot;Mi Perfil&quot;</em> o ejercer tu <strong>derecho a la eliminación definitiva</strong> mediante el botón <em>&quot;Eliminar mi cuenta permanentemente&quot;</em>, lo cual borrará de forma irreversible e inmediata tus datos personales, publicaciones, chats y fotos de nuestros servidores.
                </p>
              </div>

              {/* 6. Seguridad Técnica */}
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.75)', marginBottom: '0.4rem' }}>
                  6. Medidas de Seguridad de la Información
                </h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.55)' }}>
                  Implementamos cifrado TLS/HTTPS en tránsito, políticas de Row Level Security (RLS) en la base de datos PostgreSQL, almacenamiento aislado y autenticación basada en tokens criptográficos seguros. Las contraseñas se almacenan mediante algoritmos de hashing unidireccional y nunca son visibles para los administradores.
                </p>
              </div>

              {/* Footer */}
              <div style={{ 
                borderTop: '1px solid rgba(255,255,255,0.04)', 
                paddingTop: '1.25rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                flexWrap: 'wrap', 
                gap: '1rem' 
              }}>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.3)' }}>
                  © 2026 U-Market · Cumplimiento de la Ley Orgánica de Protección de Datos Personales del Ecuador.
                </div>
                <Link href="/" style={{ textDecoration: 'none' }}>
                  <button className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    ← Volver al inicio
                  </button>
                </Link>
              </div>

            </div>
          </div>
        </div>
      </main>
    </>
  )
}
