// ============================================
// Email Service — SMTP
// ============================================

const config = require('../config');
const { logInfo, logError } = require('../utils/logger');

let transporter = null;
let emailReady = false;

const initTransporter = () => {
  if (emailReady) return transporter;

  if (!config.SMTP.HOST || !config.SMTP.USER) {
    return null;
  }

  try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: config.SMTP.HOST,
      port: config.SMTP.PORT,
      secure: config.SMTP.PORT === 465,
      auth: {
        user: config.SMTP.USER,
        pass: config.SMTP.PASS,
      },
    });

    emailReady = true;
    logInfo('✅ Email transporter initialized');
    return transporter;
  } catch (e) {
    logError('Email init failed', e);
    return null;
  }
};

class EmailService {
  // ============================================
  // 1. SEND (main)
  // ============================================
  static async send({ to, subject, html, text = null }) {
    const t = initTransporter();

    if (!t) {
      console.log(`\n📧 [EMAIL to ${to}]: ${subject}\n`);
      return { success: true, provider: 'console' };
    }

    try {
      const info = await t.sendMail({
        from: `"${config.APP_NAME}" <${config.SMTP.FROM}>`,
        to,
        subject,
        text: text || html.replace(/<[^>]+>/g, ''),
        html,
      });

      logInfo(`Email sent to ${to}: ${subject}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logError('Email send failed', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // 2. WELCOME EMAIL
  // ============================================
  static async sendWelcome(user) {
    return this.send({
      to: user.email,
      subject: `Welcome to ${config.APP_NAME}! 🎉`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ff0000;">Welcome ${user.name}!</h1>
          <p>Thanks for joining ${config.APP_NAME}.</p>
          <p>Your account is now active. You'll receive <strong>100 bonus coins</strong> on your first login.</p>
          <p>Enjoy the experience!</p>
          <p>— The ${config.APP_NAME} Team</p>
        </div>
      `,
    });
  }

  // ============================================
  // 3. SUBSCRIPTION CONFIRMATION
  // ============================================
  static async sendSubscriptionConfirmation(user, subscription, plan) {
    return this.send({
      to: user.email,
      subject: `Subscription Confirmed: ${plan.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ff0000;">Subscription Active ✅</h1>
          <p>Hi ${user.name},</p>
          <p>Your <strong>${plan.name}</strong> subscription is now active.</p>
          <ul>
            <li>Amount: ₹${subscription.amount}</li>
            <li>Valid from: ${subscription.startDate.toLocaleDateString()}</li>
            <li>Valid until: ${subscription.endDate.toLocaleDateString()}</li>
          </ul>
          <p>Enjoy your premium features!</p>
        </div>
      `,
    });
  }

  // ============================================
  // 4. WITHDRAWAL STATUS
  // ============================================
  static async sendWithdrawalUpdate(user, withdrawal) {
    const statusEmoji = {
      APPROVED: '✅',
      REJECTED: '❌',
      COMPLETED: '💰',
    };

    return this.send({
      to: user.email,
      subject: `Withdrawal ${withdrawal.status}`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h1>Withdrawal ${statusEmoji[withdrawal.status] || ''} ${withdrawal.status}</h1>
          <p>Hi ${user.name},</p>
          <p>Your withdrawal of <strong>₹${withdrawal.amount}</strong> has been ${withdrawal.status.toLowerCase()}.</p>
          ${withdrawal.status === 'REJECTED' && withdrawal.failureReason ? `<p>Reason: ${withdrawal.failureReason}</p>` : ''}
          ${withdrawal.status === 'COMPLETED' ? `<p>Amount credited: ₹${withdrawal.netAmount}</p>` : ''}
        </div>
      `,
    });
  }

  // ============================================
  // 5. PASSWORD RESET
  // ============================================
  static async sendPasswordReset(user, resetToken) {
    const resetUrl = `${config.CORS_ORIGIN[0]}/reset-password?token=${resetToken}`;

    return this.send({
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h1>Reset Your Password</h1>
          <p>Hi ${user.name},</p>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}" style="background: #ff0000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Reset Password</a>
          <p>This link expires in 1 hour.</p>
          <p>If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
  }

  // ============================================
  // 6. REPORT RESOLVED
  // ============================================
  static async sendReportResolved(user, report) {
    return this.send({
      to: user.email,
      subject: 'Your Report Has Been Resolved',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h1>Report Resolved</h1>
          <p>Hi ${user.name},</p>
          <p>Your report from ${new Date(report.createdAt).toLocaleDateString()} has been resolved.</p>
          <p>Status: <strong>${report.status}</strong></p>
          ${report.resolution ? `<p>Resolution: ${report.resolution}</p>` : ''}
          <p>Thank you for helping keep our community safe.</p>
        </div>
      `,
    });
  }
}

module.exports = EmailService;