// ============================================
// Configuration Loader — Bond (Secure)
// ============================================

const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ============================================
// Environment detection
// ============================================
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';
const IS_TEST = NODE_ENV === 'test';

// ============================================
// Validate required env vars
// ============================================
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET'];

const missing = requiredEnvVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  if (IS_PRODUCTION) {
    console.error(
      `❌ Missing required environment variables: ${missing.join(', ')}`
    );
    process.exit(1);
  } else {
    console.warn(
      `⚠️  Missing env vars in ${NODE_ENV}: ${missing.join(', ')}`
    );
  }
}

// ============================================
// ⚠️ SECURITY: Reject insecure defaults in production
// ============================================
if (IS_PRODUCTION) {
  const insecureChecks = [
    {
      key: 'JWT_SECRET',
      value: process.env.JWT_SECRET,
      minLength: 32,
      forbidden: ['default', 'change', 'secret', 'test'],
    },
    {
      key: 'REFRESH_TOKEN_SECRET',
      value: process.env.REFRESH_TOKEN_SECRET,
      minLength: 32,
      forbidden: ['default', 'change', 'secret', 'test'],
    },
  ];

  for (const check of insecureChecks) {
    if (!check.value) continue;

    // Length check
    if (check.value.length < check.minLength) {
      console.error(
        `❌ SECURITY: ${check.key} must be at least ${check.minLength} chars in production (current: ${check.value.length})`
      );
      process.exit(1);
    }

    // Forbidden substring check
    const lower = check.value.toLowerCase();
    for (const word of check.forbidden) {
      if (lower.includes(word)) {
        console.error(
          `❌ SECURITY: ${check.key} contains forbidden word "${word}" in production`
        );
        process.exit(1);
      }
    }
  }

  // CORS wildcard check
  if (process.env.CORS_ORIGIN?.includes('*')) {
    console.error(
      '❌ SECURITY: CORS_ORIGIN cannot contain "*" in production'
    );
    process.exit(1);
  }
}

// ============================================
// Helper: Safe CORS origins
// ============================================
const parseCorsOrigin = () => {
  const raw = process.env.CORS_ORIGIN;

  if (!raw) {
    if (IS_PRODUCTION) {
      console.warn(
        '⚠️  CORS_ORIGIN not set in production — using empty (no origins allowed)'
      );
      return [];
    }
    // Dev defaults
    return [
      'http://localhost:3000',
      'http://localhost:8081',
      'http://localhost:19006',
      'http://localhost:5173',
    ];
  }

  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

// ============================================
// Helper: Safe Firebase private key (fix newlines)
// ============================================
const parseFirebasePrivateKey = () => {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) return '';

  // Handle both literal \n and actual newlines
  return raw.replace(/\\n/g, '\n');
};

// ============================================
// Config Object
// ============================================
const config = {
  // Server
  NODE_ENV,
  PORT: parseInt(process.env.PORT || '5000', 10),
  API_PREFIX: process.env.API_PREFIX || '/api',
  APP_NAME: process.env.APP_NAME || 'Bond',
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  IS_TEST,

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRE: process.env.REFRESH_TOKEN_EXPIRE || '30d',

  // Admin
  ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY || '',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@bond.app',

  // OTP
  OTP_EXPIRE: parseInt(process.env.OTP_EXPIRE || '300', 10),
  OTP_LENGTH: parseInt(process.env.OTP_LENGTH || '6', 10),
  OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),

  // Rate Limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '15', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10),

  // CORS
  CORS_ORIGIN: parseCorsOrigin(),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_DIR: process.env.LOG_DIR || 'logs',

  // Upload
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
  PUBLIC_BASE_URL:
    process.env.PUBLIC_BASE_URL ||
    (IS_PRODUCTION ? '' : 'http://localhost:5000'),

  // Cloudinary
  CLOUDINARY: {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    API_KEY: process.env.CLOUDINARY_API_KEY || '',
    API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
    FOLDER: process.env.CLOUDINARY_FOLDER || 'bond',
  },

  // Firebase
  FIREBASE: {
    PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
    PRIVATE_KEY: parseFirebasePrivateKey(),
    CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  },

  // Razorpay
  RAZORPAY: {
    KEY_ID: process.env.RAZORPAY_KEY_ID || '',
    KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
    WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  // SMS
  SMS: {
    PROVIDER: process.env.SMS_PROVIDER || 'console',
    API_KEY: process.env.SMS_API_KEY || '',
    SENDER_ID: process.env.SMS_SENDER_ID || 'BOND',
    TEMPLATE_ID: process.env.SMS_TEMPLATE_ID || '',
  },
// RAZORPAY section को हटाओ, और ये add करो:

GOOGLE_PLAY: {
  // Service Account JSON from Google Cloud Console
  // File path or JSON string
  SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL || '',
  PRIVATE_KEY: process.env.GOOGLE_PLAY_PRIVATE_KEY || '',
  PACKAGE_NAME: process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.jony88.bond',
},
  // Email
  SMTP: {
    HOST: process.env.SMTP_HOST || '',
    PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    USER: process.env.SMTP_USER || '',
    PASS: process.env.SMTP_PASS || '',
    FROM: process.env.SMTP_FROM || 'noreply@bond.app',
  },

  // Business Rules
  BUSINESS: {
    SIGNUP_BONUS_COINS: parseInt(process.env.SIGNUP_BONUS_COINS || '100', 10),
    REFERRAL_BONUS_COINS: parseInt(process.env.REFERRAL_BONUS_COINS || '50', 10),
    DAILY_BONUS_COINS: parseInt(process.env.DAILY_BONUS_COINS || '10', 10),
    VOICE_CALL_RATE: parseInt(process.env.VOICE_CALL_RATE || '10', 10),
    VIDEO_CALL_RATE: parseInt(process.env.VIDEO_CALL_RATE || '20', 10),
    MESSAGE_COST: parseInt(process.env.MESSAGE_COST || '1', 10),
    GIFT_RECEIVER_PERCENT: parseInt(process.env.GIFT_RECEIVER_PERCENT || '50', 10),
    WITHDRAWAL_MIN_AMOUNT: parseInt(
      process.env.WITHDRAWAL_MIN_AMOUNT || '100',
      10
    ),
    WITHDRAWAL_FEE_PERCENT: parseInt(
      process.env.WITHDRAWAL_FEE_PERCENT || '2',
      10
    ),
    COIN_TO_RUPEE_RATE: parseFloat(process.env.COIN_TO_RUPEE_RATE || '1'),
    GIRL_PAYOUT_PERCENT: parseFloat(process.env.GIRL_PAYOUT_PERCENT || '70'),
  },

  // Socket
  SOCKET: {
    PORT: parseInt(process.env.SOCKET_PORT || process.env.PORT || '5000', 10),
    PATH: process.env.SOCKET_PATH || '/socket.io',
  },

  // Maintenance
  MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === 'true',

  // Helpers
  isProduction: IS_PRODUCTION,
  isDevelopment: IS_DEVELOPMENT,
  isTest: IS_TEST,
};

// ============================================
// Safe export
// ============================================
module.exports = config;