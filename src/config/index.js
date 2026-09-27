// ============================================
// Configuration Loader
// ============================================

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ============================================
// Validate required env vars
// ============================================
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET'];

const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0 && process.env.NODE_ENV === 'production') {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// ============================================
// Config Object
// ============================================
const config = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  API_PREFIX: process.env.API_PREFIX || '/api',
  APP_NAME: process.env.APP_NAME || 'Social Platform',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'default-refresh-secret-change-in-production',
  REFRESH_TOKEN_EXPIRE: process.env.REFRESH_TOKEN_EXPIRE || '30d',

  // Admin
  ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY || 'admin-secret',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@socialplatform.com',

  // OTP
  OTP_EXPIRE: parseInt(process.env.OTP_EXPIRE || '300', 10),
  OTP_LENGTH: parseInt(process.env.OTP_LENGTH || '6', 10),
  OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),

  // Rate Limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '15', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10),

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : ['http://localhost:3000', 'http://localhost:8081'],

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_DIR: process.env.LOG_DIR || 'logs',

  // Upload
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),

  // Cloudinary
  CLOUDINARY: {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    API_KEY: process.env.CLOUDINARY_API_KEY || '',
    API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
    FOLDER: process.env.CLOUDINARY_FOLDER || 'social-platform',
  },

  // Firebase
  FIREBASE: {
    PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
    PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : '',
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
    SENDER_ID: process.env.SMS_SENDER_ID || 'SOCIAL',
  },

  // Email
  SMTP: {
    HOST: process.env.SMTP_HOST || '',
    PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    USER: process.env.SMTP_USER || '',
    PASS: process.env.SMTP_PASS || '',
    FROM: process.env.SMTP_FROM || 'noreply@socialplatform.com',
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
    WITHDRAWAL_MIN_AMOUNT: parseInt(process.env.WITHDRAWAL_MIN_AMOUNT || '100', 10),
    WITHDRAWAL_FEE_PERCENT: parseInt(process.env.WITHDRAWAL_FEE_PERCENT || '2', 10),
  },

  // Socket
  SOCKET: {
    PORT: parseInt(process.env.SOCKET_PORT || process.env.PORT || '5000', 10),
    PATH: process.env.SOCKET_PATH || '/socket.io',
  },

  // Maintenance
  MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === 'true',
};

module.exports = config;