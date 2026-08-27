import Navbar from '@/components/Navbar'
import Link from 'next/link'

export default function TerminosPage() {
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
              color: 'rgba(255, 255, 255, 0.55)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              transition: 'all 0.3s ease'
            }}
          >
            
            {/* Header sutil */}
            <div style={{ marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem' }}>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: 'rgba(99, 102, 241, 0.7)',
                background: 'rgba(99, 102, 241, 0.08)',
                padding: '4px 10px',
                borderRadius: 20,
                border: '1px solid rgba(99, 102, 241, 0.15)',
                display: 'inline-block',
                marginBottom: 12
              }}>
                Aviso Legal & Términos
              </span>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.4rem' }}>
                Términos y Condiciones de Uso
              </h1>
              <p style={{ color: 'rgba(255, 255, 255, 0.35)', fontSize: '0.8rem' }}>
                Entrada en vigor: 2026 · Propiedad Intelectual Registrada
              </p>
            </div>
            
            <div style={{ lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: '1.75rem', fontSize: '0.9rem' }}>
              
              <p style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
                Bienvenido a <strong style={{ color: 'rgba(255, 255, 255, 0.9)' }}>U-Market</strong>. Al acceder, registrarte o hacer uso de esta plataforma, reconoces y aceptas los siguientes términos de servicio y titularidad.
              </p>

              {/* Cláusula de Propiedad Intelectual - Estilo discreto pero firme */}
              <div style={{
                background: 'rgba(99, 102, 241, 0.03)',
                border: '1px solid rgba(99, 102, 241, 0.12)',
                padding: '1.25rem 1.5rem',
                borderRadius: 16
              }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(165, 180, 252, 0.85)', marginBottom: '0.6rem' }}>
                  1. Titularidad Exclusiva y Derechos de Autor
                </h2>
                <p style={{ marginBottom: '0.6rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                  La plataforma <strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>U-Market</strong>, su código fuente, arquitectura, diseños, logotipos y bases de datos son de propiedad <strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>única y exclusiva de Alen Lenin Villamarín Velasco</strong> (&quot;El Titular&quot;).
                </p>
                <p style={{ marginBottom: '0.6rem', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.45)' }}>
                  <em>Alcance institucional:</em> La denominación &quot;Universidad Técnica de Ambato&quot; (UTA) y el dominio <code>@uta.edu.ec</code> identifican únicamente a la comunidad académica usuaria. La institución no posee propiedad, titularidad ni derechos patrimoniales o morales sobre este software.
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.45)' }}>
                  Queda prohibida la reproducción, copia, distribución o ingeniería inversa sin autorización previa y por escrito del titular.
                </p>
              </div>

              {/* 2. Autorización Expresa y Tratamiento de Datos (LOPDP) */}
              <div style={{
                background: 'rgba(99, 102, 241, 0.04)',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                padding: '1.25rem 1.5rem',
                borderRadius: 16
              }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(165, 180, 252, 0.9)', marginBottom: '0.6rem' }}>
                  2. Consentimiento Expreso para el Manejo y Uso de Datos Personales
                </h2>
                <p style={{ marginBottom: '0.6rem', color: 'rgba(255, 255, 255, 0.65)' }}>
                  Al registrarte en U-Market, otorgas tu <strong>consentimiento libre, específico, inequívoco e informado</strong>, en conformidad con la <strong>Ley Orgánica de Protección de Datos Personales (LOPDP)</strong> del Ecuador, para que la plataforma recopile, almacene y procese los siguientes datos:
                </p>
                <ul style={{ paddingLeft: '1.25rem', marginBottom: '0.6rem', color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.85rem' }}>
                  <li>Nombre completo y correo institucional (<code>@uta.edu.ec</code>).</li>
                  <li>Facultad, carrera universitaria y semestre en curso.</li>
                  <li>Número de contacto telefónico/WhatsApp y fotografía de perfil (si son proporcionados).</li>
                  <li>Contenido e imágenes de las publicaciones y mensajes dentro del chat interno.</li>
                </ul>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                  <strong>Finalidad exclusiva:</strong> Estos datos se utilizarán únicamente para autenticar la pertenencia a la comunidad universitaria, asegurar la confianza en las interacciones comerciales, moderar contenidos y generar métricas estadísticas agregadas y anónimas. <strong>U-Market no vende, no comercializa ni transfiere tus datos a empresas externas.</strong>
                </p>
              </div>

              {/* 3. Elegibilidad */}
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.75)', marginBottom: '0.4rem' }}>
                  3. Cuentas y Verificación Estudiantil
                </h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  El servicio está destinado a la comunidad de la Universidad Técnica de Ambato (UTA). Requiere registro mediante un correo institucional activo (<code style={{ color: 'rgba(165, 180, 252, 0.8)' }}>@uta.edu.ec</code>). El usuario es responsable de mantener la confidencialidad de sus credenciales y de la veracidad de los datos académicos ingresados.
                </p>
              </div>

              {/* 4. Intermediación */}
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.75)', marginBottom: '0.4rem' }}>
                  4. Carácter Intermediario y Responsabilidad Comercial
                </h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  U-Market opera como una plataforma informática de intermediación y catálogo estudiantil. La plataforma no procesa pagos en línea ni participa en la entrega física de los productos. Toda negociación, acuerdo de pago y entrega es de exclusiva responsabilidad entre el comprador y el vendedor.
                </p>
              </div>

              {/* 5. Artículos Prohibidos */}
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.75)', marginBottom: '0.4rem' }}>
                  5. Artículos Prohibidos y Normas de Convivencia
                </h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  Queda estrictamente prohibida la publicación y comercialización de: sustancias ilícitas, alcohol, armas, réplicas o artículos falsificados, servicios de realización de exámenes/fraude académico, o cualquier producto que infrinja los reglamentos de la UTA o las leyes de la República del Ecuador.
                </p>
              </div>

              {/* 6. Moderación y Sanciones */}
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.75)', marginBottom: '0.4rem' }}>
                  6. Moderación, Suspensión y Baja de Cuentas
                </h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  El equipo de administración y moderación se reserva el derecho de retirar de forma inmediata cualquier anuncio reportado, así como suspender o cancelar permanentemente las cuentas que incumplan estos términos o atenten contra la seguridad de los estudiantes.
                </p>
              </div>

              {/* 7. Modificaciones */}
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.75)', marginBottom: '0.4rem' }}>
                  7. Actualizaciones de los Términos
                </h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                  Los presentes términos pueden ser actualizados periódicamente para reflejar mejoras en la plataforma o nuevas disposiciones regulatorias. El uso continuo de la plataforma implica la aceptación de las versiones vigentes.
                </p>
              </div>

              {/* Footer discreto */}
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
                  © 2026 U-Market · Propiedad de Alen Lenin Villamarín Velasco. Todos los derechos reservados.
                </div>
                <Link href="/" style={{ textDecoration: 'none' }}>
                  <button className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    ← Volver
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
