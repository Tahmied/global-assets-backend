import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
dotenv.config({path: './.env'})

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,        // e.g. "smtp.gmail.com"
  port: process.env.SMTP_PORT,        // e.g. 587
  secure: process.env.SMTP_SECURE,                       // true for 465, false for other ports
  auth: {
    user: `${process.env.SMTP_USER}`,      // your SMTP username
    pass: `${process.env.SMTP_PASS}`   // your SMTP password
  }
});

export async function sendEmail({ to, subject, text, html }) {
  const msg = {
    from: `"Global Asset" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html
  };
  return transporter.sendMail(msg);
}