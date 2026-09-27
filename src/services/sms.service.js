// ============================================
// SMS Service — MSG91 / Twilio / Console
// ============================================

const config = require('../config');
const { logInfo, logError } = require('../utils/logger');

class SmsService {
  // ============================================
  // 1. SEND OTP
  // ============================================
  static async sendOTP(phone, otp) {
    const message = `Your ${config.APP_NAME} OTP is ${otp}. Valid for ${config.OTP_EXPIRE / 60} minutes. Do not share.`;

    return this.send(phone, message);
  }

  // ============================================
  // 2. SEND SMS (main dispatcher)
  // ============================================
  static async send(phone, message) {
    const provider = config.SMS.PROVIDER;

    // Console fallback (development)
    if (provider === 'console' || !config.SMS.API_KEY) {
      console.log(`\n📱 [SMS to ${phone}]: ${message}\n`);
      return { success: true, provider: 'console' };
    }

    try {
      switch (provider) {
        case 'msg91':
          return await this.sendMSG91(phone, message);
        case 'twilio':
          return await this.sendTwilio(phone, message);
        case 'fast2sms':
          return await this.sendFast2SMS(phone, message);
        default:
          throw new Error(`Unknown SMS provider: ${provider}`);
      }
    } catch (error) {
      logError('SMS send failed', error);
      // Still log to console in dev
      if (!config.IS_PRODUCTION) {
        console.log(`\n📱 [SMS-FAILED-FALLBACK to ${phone}]: ${message}\n`);
      }
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // 3. MSG91
  // ============================================
  static async sendMSG91(phone, message) {
    const axios = require('axios');
    const url = 'https://api.msg91.com/api/v5/flow/';

    const payload = {
      flow_id: config.SMS.TEMPLATE_ID || '',
      sender: config.SMS.SENDER_ID,
      mobiles: `91${phone}`, // country code
      OTP: message,
    };

    const response = await axios.post(url, payload, {
      headers: {
        authkey: config.SMS.API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    logInfo(`SMS sent via MSG91 to ${phone}`);
    return { success: true, provider: 'msg91', response: response.data };
  }

  // ============================================
  // 4. Twilio
  // ============================================
  static async sendTwilio(phone, message) {
    const twilio = require('twilio');
    const client = twilio(config.SMS.ACCOUNT_SID, config.SMS.API_KEY);

    const response = await client.messages.create({
      body: message,
      from: config.SMS.SENDER_ID,
      to: `+91${phone}`,
    });

    logInfo(`SMS sent via Twilio to ${phone}`);
    return { success: true, provider: 'twilio', sid: response.sid };
  }

  // ============================================
  // 5. Fast2SMS (India-specific)
  // ============================================
  static async sendFast2SMS(phone, message) {
    const axios = require('axios');
    const url = 'https://www.fast2sms.com/dev/bulkV2';

    const response = await axios.post(
      url,
      {
        route: 'q',
        message,
        language: 'english',
        flash: 0,
        numbers: phone,
      },
      {
        headers: { authorization: config.SMS.API_KEY },
        timeout: 10000,
      }
    );

    logInfo(`SMS sent via Fast2SMS to ${phone}`);
    return { success: true, provider: 'fast2sms', response: response.data };
  }
}

module.exports = SmsService;