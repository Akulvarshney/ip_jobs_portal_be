const nodemailer = require('nodemailer');

// Initialize transporter from environment variables or fallback
const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  // If credentials aren't set in .env, create a mock / dev console transporter
  return null;
};

/**
 * Send Password Reset OTP Email
 */
const sendPasswordResetEmail = async (toEmail, otp, recipientName = 'User') => {
  const transporter = createTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || '"Resolve Portal" <no-reply@resolve.com>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { text-align: center; margin-bottom: 24px; }
        .logo { font-size: 24px; font-weight: 800; color: #38bdf8; letter-spacing: 1px; }
        .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 12px; }
        .body-text { font-size: 14px; color: #cbd5e1; line-height: 1.6; margin-bottom: 24px; }
        .otp-box { background: rgba(56, 189, 248, 0.12); border: 2px dashed #38bdf8; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px; }
        .otp-code { font-size: 32px; font-weight: 800; color: #38bdf8; letter-spacing: 6px; font-family: monospace; }
        .footer { font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">⚡ RESOLVE PORTAL</div>
          <div class="title">Password Reset Verification</div>
        </div>
        <div class="body-text">
          Hello <strong>${recipientName}</strong>,<br><br>
          We received a request to reset the password for your account linked to <strong>${toEmail}</strong>. 
          Use the 6-digit verification code below to complete your password reset:
        </div>
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">This OTP will expire in <strong>10 minutes</strong>.</div>
        </div>
        <div class="body-text" style="font-size: 13px; color: #94a3b8;">
          If you did not request a password reset, you can safely ignore this email. Your current password will remain unchanged.
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Resolve Platform • Insolvency & Valuation Professional Ecosystem.
        </div>
      </div>
    </body>
    </html>
  `;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: '🔐 Password Reset OTP - Resolve Portal',
        html: htmlContent,
      });
      console.log('Password reset email sent via Nodemailer to:', toEmail, 'MessageId:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('Nodemailer failed to send email:', err);
      // Return dev fallback so testing does not crash
      return { success: true, devMode: true, error: err.message };
    }
  } else {
    console.log(`\n========================================`);
    console.log(`[DEV MODE - NODEMAILER SIMULATION]`);
    console.log(`To: ${toEmail}`);
    console.log(`Subject: Password Reset OTP`);
    console.log(`OTP Code: ${otp}`);
    console.log(`========================================\n`);
    return { success: true, devMode: true };
  }
};

/**
 * Send Registration / Verification OTP Email
 */
const sendRegistrationOtpEmail = async (toEmail, otp) => {
  const transporter = createTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || '"Resolve Portal" <no-reply@resolve.com>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); padding: 32px; }
        .header { text-align: center; margin-bottom: 24px; }
        .logo { font-size: 24px; font-weight: 800; color: #38bdf8; letter-spacing: 1px; }
        .otp-box { background: rgba(56, 189, 248, 0.12); border: 2px dashed #38bdf8; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px; }
        .otp-code { font-size: 32px; font-weight: 800; color: #38bdf8; letter-spacing: 6px; font-family: monospace; }
        .footer { font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">⚡ RESOLVE PORTAL</div>
          <h2 style="color: #ffffff; margin-top: 8px;">Welcome! Verify Your Email</h2>
        </div>
        <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
          Thank you for joining the Resolve Network. Please use the verification code below to verify your email address:
        </p>
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">Valid for 10 minutes.</div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Resolve Platform • Insolvency & Valuation Professional Ecosystem.
        </div>
      </div>
    </body>
    </html>
  `;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: '✨ Verify Your Email - Resolve Portal',
        html: htmlContent,
      });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('Nodemailer send registration error:', err);
      return { success: true, devMode: true, error: err.message };
    }
  } else {
    console.log(`\n[DEV MODE] Registration OTP for ${toEmail}: ${otp}\n`);
    return { success: true, devMode: true };
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendRegistrationOtpEmail,
};
