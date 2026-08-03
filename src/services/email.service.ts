import dns from 'dns';
import nodemailer from 'nodemailer';
import { ENV } from '../config/env';
import { logger } from '../utils/logger';

// Force Node.js DNS resolver to prioritize IPv4 addresses
dns.setDefaultResultOrder('ipv4first');

/**
 * Creates a Nodemailer transporter using Gmail SMTP or custom SMTP.
 * In development without credentials, falls back to console logging only.
 */
function createTransporter() {
  if (!ENV.EMAIL.USER || !ENV.EMAIL.PASS) {
    return null;
  }

  // Clean App Password by stripping any whitespace
  const cleanPass = ENV.EMAIL.PASS.replace(/\s+/g, '');

  return nodemailer.createTransport({
    host: ENV.EMAIL.HOST,
    port: ENV.EMAIL.PORT,
    secure: ENV.EMAIL.PORT === 465 || ENV.EMAIL.SECURE,
    family: 4, // Force IPv4 connection to prevent ENETUNREACH on IPv6 unroutable networks
    connectionTimeout: 10000, // 10 seconds connection timeout
    greetingTimeout: 5000,
    socketTimeout: 10000,
    auth: {
      user: ENV.EMAIL.USER,
      pass: cleanPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  } as any);
}

const transporter = createTransporter();

export class EmailService {
  /**
   * Send 6-Digit OTP Code via real SMTP email using Nodemailer.
   * Falls back to console logging if SMTP credentials are not configured.
   */
  static async sendOtpEmail(
    email: string,
    otpCode: string,
    purpose: 'VERIFY_EMAIL' | 'FORGOT_PASSWORD'
  ): Promise<boolean> {
    const isVerify = purpose === 'VERIFY_EMAIL';
    const title = isVerify ? 'Verifikasi Akun' : 'Reset Kata Sandi';
    const purposeText = isVerify
      ? 'menyelesaikan pendaftaran akun Muslim App Anda'
      : 'mengatur ulang kata sandi akun Muslim App Anda';
    const iconEmoji = isVerify ? '✅' : '🔐';

    const htmlBody = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background-color: #0F172A;
      color: #CBD5E1;
    }
    .wrapper {
      max-width: 560px;
      margin: 40px auto;
      background: #1E293B;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid #334155;
    }
    .header {
      background: linear-gradient(135deg, #16A34A 0%, #15803D 50%, #065F46 100%);
      padding: 40px 32px 32px;
      text-align: center;
    }
    .header-icon { font-size: 48px; display: block; margin-bottom: 12px; }
    .header h1 {
      font-size: 22px;
      font-weight: 700;
      color: #FFFFFF;
      letter-spacing: 0.3px;
    }
    .body { padding: 36px 32px; }
    .greeting { font-size: 16px; color: #94A3B8; margin-bottom: 18px; }
    .desc {
      font-size: 14px;
      color: #94A3B8;
      line-height: 1.7;
      margin-bottom: 28px;
    }
    .otp-box {
      background: #0F172A;
      border: 2px solid #16A34A;
      border-radius: 16px;
      text-align: center;
      padding: 24px 16px;
      margin-bottom: 28px;
    }
    .otp-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #64748B;
      margin-bottom: 12px;
    }
    .otp-code {
      font-size: 44px;
      font-weight: 800;
      letter-spacing: 12px;
      color: #4ADE80;
      font-family: 'Courier New', monospace;
    }
    .otp-validity {
      font-size: 12px;
      color: #64748B;
      margin-top: 10px;
    }
    .warning-box {
      background: #1A1004;
      border: 1px solid #92400E;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 24px;
    }
    .warning-box p { font-size: 12px; color: #D97706; line-height: 1.5; }
    .footer {
      border-top: 1px solid #334155;
      padding: 24px 32px;
      text-align: center;
    }
    .footer p { font-size: 12px; color: #475569; line-height: 1.6; }
    .app-name { color: #4ADE80; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="header-icon">${iconEmoji}</span>
      <h1>Kode OTP — ${title}</h1>
    </div>

    <div class="body">
      <p class="greeting">Assalamu'alaikum,</p>
      <p class="desc">
        Anda menerima email ini karena sedang ${purposeText}.
        Gunakan kode OTP berikut untuk melanjutkan proses Anda:
      </p>

      <div class="otp-box">
        <p class="otp-label">Kode OTP Anda</p>
        <p class="otp-code">${otpCode}</p>
        <p class="otp-validity">⏳ Berlaku selama <strong>10 menit</strong></p>
      </div>

      <div class="warning-box">
        <p>
          ⚠️ <strong>Jangan bagikan kode ini kepada siapapun.</strong>
          Tim Muslim App tidak akan pernah meminta kode OTP Anda melalui telepon, email, atau pesan apa pun.
          Jika Anda tidak meminta kode ini, abaikan email ini.
        </p>
      </div>
    </div>

    <div class="footer">
      <p>
        Email ini dikirim secara otomatis oleh <span class="app-name">Muslim App</span>.<br/>
        Mohon jangan membalas email ini.
      </p>
    </div>
  </div>
</body>
</html>`;

    const subject = `[Muslim App] Kode OTP ${title} — ${otpCode}`;

    // Always log to console (useful for development)
    logger.info(`=================================================`);
    logger.info(`[EMAIL OTP] To: ${email} | Code: ${otpCode} | Purpose: ${purpose}`);
    logger.info(`=================================================`);

    // If no SMTP configured, fall back to console only
    if (!transporter) {
      logger.warn(`[EmailService] SMTP not configured — OTP logged to console only. Add EMAIL_USER/EMAIL_PASS to .env`);
      return true;
    }

    try {
      const fromAddress = ENV.EMAIL.FROM_ADDRESS || ENV.EMAIL.USER;
      const fromName = ENV.EMAIL.FROM_NAME || 'Muslim App';

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        subject,
        html: htmlBody,
        text: `Kode OTP Muslim App Anda: ${otpCode}\nBerlaku 10 menit.\n\nJangan bagikan kode ini kepada siapapun.`,
      });

      logger.info(`[EmailService] Email delivered → MessageID: ${info.messageId} → To: ${email}`);
      return true;
    } catch (err: any) {
      logger.error(`[EmailService] Failed to send OTP email to ${email}: ${err.message}`);
      // Don't throw — just return false so caller can handle gracefully
      return false;
    }
  }
}
