import nodemailer from 'nodemailer';
import { env } from '../../shared/config/env.ts';

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false, // Mailpit speaks plain SMTP on 1025
});

export function renderWelcome(name: string): { subject: string; text: string } {
  const greeting = name.trim() || 'there';
  return {
    subject: 'Welcome to React_Intro!',
    text: `Hi ${greeting}, thanks for signing up. Your account is ready.`,
  };
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const { subject, text } = renderWelcome(name);
  await transport.sendMail({ from: env.MAIL_FROM, to: email, subject, text });
}
