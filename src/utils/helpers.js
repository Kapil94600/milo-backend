// ============================================
// Helper Functions
// ============================================

const crypto = require('crypto');
const config = require('../config');

// ============================================
// Phone
// ============================================
const normalizePhone = (phone) => {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  // Remove country code if present
  if (cleaned.length > 10 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2);
  }
  return cleaned;
};

const isValidPhone = (phone) => {
  const cleaned = normalizePhone(phone);
  return /^\d{10,15}$/.test(cleaned);
};

// ============================================
// OTP
// ============================================
const generateOTP = (length = config.OTP_LENGTH) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
};

// ============================================
// String
// ============================================
const generateRandomString = (length = 16) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};

const generateReferralCode = (name = 'USER') => {
  const prefix = String(name).toUpperCase().slice(0, 3).padEnd(3, 'X');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${suffix}`;
};

const slugify = (text) => {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// ============================================
// Pagination
// ============================================
const getPagination = (query = {}) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
  return { page, limit, skip, sortBy, sortOrder };
};

const buildPagination = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNext: page * limit < total,
  hasPrev: page > 1,
});

// ============================================
// Date
// ============================================
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const addMinutes = (date, minutes) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
};

const isExpired = (date) => new Date(date) < new Date();

// ============================================
// Money
// ============================================
const round = (num, decimals = 2) => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

const calculateWithdrawalFee = (amount) => {
  const feePercent = config.BUSINESS.WITHDRAWAL_FEE_PERCENT;
  return round((amount * feePercent) / 100, 2);
};

// ============================================
// Validation
// ============================================
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidObjectId = (id) => /^c[a-z0-9]{24}$/i.test(String(id));

// ============================================
// Object
// ============================================
const pick = (obj, keys) => {
  const result = {};
  for (const key of keys) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
};

const omit = (obj, keys) => {
  const result = { ...obj };
  for (const key of keys) delete result[key];
  return result;
};

// ============================================
// Sleep
// ============================================
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  normalizePhone,
  isValidPhone,
  generateOTP,
  generateRandomString,
  generateReferralCode,
  slugify,
  getPagination,
  buildPagination,
  addDays,
  addMinutes,
  isExpired,
  round,
  calculateWithdrawalFee,
  isValidEmail,
  isValidObjectId,
  pick,
  omit,
  sleep,
};