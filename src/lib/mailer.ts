import nodemailer from 'nodemailer'

function getMailerCredentials() {
  const user = process.env.EMAIL_USER?.trim()
  const pass = process.env.EMAIL_PASS?.trim()
  return { user, pass }
}

export function isMailerConfigured(): boolean {
  const { user, pass } = getMailerCredentials()
  return Boolean(user && pass)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildStyledEmailHtml(params: {
  greeting: string
  intro: string
  label: string
  code: string
  outro: string
}) {
  return `
<div style="background-color:#f8fafc;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0a192f;">
  <div style="max-width:500px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
    <div style="background-color:#00345e;padding:18px 24px;color:#ffffff;">
      <span style="display:inline-block;background-color:#ffffff;color:#00345e;font-weight:900;font-size:16px;width:28px;height:28px;line-height:28px;text-align:center;border-radius:7px;margin-right:8px;vertical-align:middle;">U</span>
      <span style="font-size:18px;font-weight:800;vertical-align:middle;color:#ffffff;">U-Market</span>
    </div>
    <div style="padding:26px 24px;">
      <h2 style="margin:0 0 10px 0;font-size:19px;color:#0a192f;">${escapeHtml(params.greeting)}</h2>
      <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#334155;">
        ${escapeHtml(params.intro)}
      </p>
      <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;text-align:center;margin-bottom:18px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#004b87;margin-bottom:6px;">
          ${escapeHtml(params.label)}
        </div>
        <div style="font-size:30px;font-weight:900;letter-spacing:6px;color:#00345e;font-family:monospace;">
          ${escapeHtml(params.code)}
        </div>
      </div>
      <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">
        ${escapeHtml(params.outro)}
      </p>
    </div>
    <div style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 24px;text-align:center;font-size:12px;color:#64748b;">
      U-Market · Marketplace estudiantil
    </div>
  </div>
</div>`.trim()
}

async function sendStyledEmail(params: {
  to: string
  subject: string
  text: string
  html: string
}) {
  const { user, pass } = getMailerCredentials()
  if (!user || !pass) {
    throw new Error('Configuración de correo (EMAIL_USER / EMAIL_PASS) incompleta en el servidor')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })

  return transporter.sendMail({
    from: `"U-Market" <${user}>`,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  })
}

export async function sendRegistrationCodeEmail(params: {
  to: string
  code: string
  fullName?: string
}) {
  const firstName = params.fullName?.trim()
    ? params.fullName.trim().split(/\s+/)[0]
    : ''
  const greeting = firstName ? `Hola, ${firstName}` : 'Hola'
  const cleanCode = params.code.trim()
  const intro = 'Gracias por registrarte en U-Market. Para completar la verificacion de tu cuenta e ingresar a la plataforma, escribe el siguiente codigo en la pantalla de registro:'
  const outro = 'Si no solicitaste crear una cuenta en U-Market, puedes ignorar este mensaje con tranquilidad.'

  return sendStyledEmail({
    to: params.to,
    subject: 'Confirmacion de cuenta U-Market',
    text: `${greeting},\n\n${intro}\n\nCodigo de confirmacion: ${cleanCode}\n\n${outro}\n\nU-Market`,
    html: buildStyledEmailHtml({
      greeting,
      intro,
      label: 'Codigo de confirmacion',
      code: cleanCode,
      outro,
    }),
  })
}

export async function sendPasswordResetCodeEmail(params: {
  to: string
  code: string
}) {
  const cleanCode = params.code.trim()
  const intro = 'Recibimos una solicitud para restablecer tu clave en U-Market. Escribe este codigo en la pantalla de recuperacion para crear una nueva contraseña:'
  const outro = 'Si no pediste cambiar tu clave, no necesitas hacer nada; tu cuenta sigue segura.'

  return sendStyledEmail({
    to: params.to,
    subject: 'Recuperacion de clave U-Market',
    text: `Hola,\n\n${intro}\n\nCodigo de recuperacion: ${cleanCode}\n\n${outro}\n\nU-Market`,
    html: buildStyledEmailHtml({
      greeting: 'Hola',
      intro,
      label: 'Codigo de recuperacion',
      code: cleanCode,
      outro,
    }),
  })
}
