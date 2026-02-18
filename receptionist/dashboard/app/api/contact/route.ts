import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const TO_EMAIL = process.env.CONTACT_EMAIL_TO || process.env.BUSINESS_OWNER_EMAIL || 'codedbytyler@gmail.com'
const FROM_EMAIL = process.env.CONTACT_EMAIL_FROM || TO_EMAIL
const APP_PASSWORD = process.env.CONTACT_EMAIL_APP_PASSWORD || process.env.EMAIL_APP_PASSWORD

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, message, subject } = body as { name?: string; email?: string; message?: string; subject?: string }

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Name, email, and message are required' }, { status: 400 })
    }

    if (!APP_PASSWORD) {
      console.error('[Contact] No CONTACT_EMAIL_APP_PASSWORD or EMAIL_APP_PASSWORD set')
      return NextResponse.json({ error: 'Contact form is not configured' }, { status: 503 })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: FROM_EMAIL,
        pass: APP_PASSWORD,
      },
    })

    const mailSubject = subject?.trim() ? `[AI Receptionist Contact] ${subject.trim()}` : '[AI Receptionist Contact] New message'
    const text = `From: ${name.trim()} <${email.trim()}>\n\n${message.trim()}`
    const html = `<p><strong>From:</strong> ${name.trim()} &lt;${email.trim()}&gt;</p><pre>${message.trim()}</pre>`

    await transporter.sendMail({
      from: `"AI Receptionist Contact" <${FROM_EMAIL}>`,
      to: TO_EMAIL,
      replyTo: email.trim(),
      subject: mailSubject,
      text,
      html,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Contact] Send error:', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
