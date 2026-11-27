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

async function sendPlainTextEmail(params: { to: string; subject: string; text: string }) {
  const { user, pass } = getMailerCredentials()
  if (!user || !pass) {
    throw new Error('Configuración de correo (EMAIL_USER / EMAIL_PASS) incompleta en el servidor')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })

  return transporter.sendMail({
    from: user,
    to: params.to,
    subject: params.subject,
    text: params.text,
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
  const greeting = firstName ? `Hola ${firstName},` : 'Hola,'

  return sendPlainTextEmail({
    to: params.to,
    subject: 'Confirmacion de cuenta U-Market',
    text: [
      greeting,
      '',
      `Tu codigo de confirmacion en U-Market es: ${params.code.trim()}`,
      '',
      'Ingresa este codigo en la pantalla de registro para activar tu cuenta.',
      '',
      'Saludos,',
      'U-Market',
    ].join('\n'),
  })
}

export async function sendPasswordResetCodeEmail(params: {
  to: string
  code: string
}) {
  return sendPlainTextEmail({
    to: params.to,
    subject: 'Recuperacion de clave U-Market',
    text: [
      'Hola,',
      '',
      `Tu codigo para cambiar tu clave en U-Market es: ${params.code.trim()}`,
      '',
      'Ingresa este codigo en la pantalla de recuperacion para continuar.',
      '',
      'Saludos,',
      'U-Market',
    ].join('\n'),
  })
}
