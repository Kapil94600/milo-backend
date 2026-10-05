// ============================================
// Girl Validators (Joi) — with Rate Validation
// ============================================

const Joi = require('joi');

// ============================================
// Rate constants (matches service)
// ============================================
const MIN_HOURLY_RATE = 50;
const MAX_HOURLY_RATE = 5000;
const MIN_VIDEO_RATE = 100;
const MAX_VIDEO_RATE = 10000;
const MIN_CHAT_RATE = 1;
const MAX_CHAT_RATE = 50;

// ============================================
// Reusable Rate Schema
// ============================================
const rateSchema = {
  hourlyRate: Joi.number()
    .min(MIN_HOURLY_RATE)
    .max(MAX_HOURLY_RATE)
    .messages({
      'number.min': `Hourly rate must be at least ₹${MIN_HOURLY_RATE}`,
      'number.max': `Hourly rate cannot exceed ₹${MAX_HOURLY_RATE}`,
    }),

  videoCallRate: Joi.number()
    .min(MIN_VIDEO_RATE)
    .max(MAX_VIDEO_RATE)
    .messages({
      'number.min': `Video call rate must be at least ₹${MIN_VIDEO_RATE}`,
      'number.max': `Video call rate cannot exceed ₹${MAX_VIDEO_RATE}`,
    }),

  chatMessageRate: Joi.number()
    .min(MIN_CHAT_RATE)
    .max(MAX_CHAT_RATE)
    .messages({
      'number.min': `Chat rate must be at least ${MIN_CHAT_RATE} coin`,
      'number.max': `Chat rate cannot exceed ${MAX_CHAT_RATE} coins`,
    }),
};

// ============================================
// SELF — Create My Profile (Onboarding)
// ============================================
const createMyProfile = {
  body: Joi.object({
    about: Joi.string().max(500).allow('', null),
    categories: Joi.array().items(Joi.string()).default([]),
    languages: Joi.array().items(Joi.string()).default([]),
    specialties: Joi.array().items(Joi.string()).default([]),

    // ⭐ RATES
    hourlyRate: rateSchema.hourlyRate.default(100),
    videoCallRate: rateSchema.videoCallRate.default(200),
    chatMessageRate: rateSchema.chatMessageRate.default(1),
  })
    .unknown(true)
    .prefs({ convert: true, abortEarly: false }),
};

// ============================================
// ⭐ SELF — Update My Rates
// ============================================
const updateMyRates = {
  body: Joi.object({
    hourlyRate: rateSchema.hourlyRate,
    videoCallRate: rateSchema.videoCallRate,
    chatMessageRate: rateSchema.chatMessageRate,
  })
    .min(1)
    .prefs({ convert: true, abortEarly: false }),
};

// ============================================
// Admin — Create Girl
// ============================================
const createGirlProfile = {
  body: Joi.object({
    userId: Joi.string().allow(null, ''),
    phone: Joi.string().allow('', null),
    name: Joi.string().allow('', null),
    email: Joi.string().email().allow('', null),
    about: Joi.string().max(500).allow('', null),
    categories: Joi.array().items(Joi.string()).default([]),
    languages: Joi.array().items(Joi.string()).default([]),
    specialties: Joi.array().items(Joi.string()).default([]),

    // ⭐ RATES
    hourlyRate: rateSchema.hourlyRate.default(100),
    videoCallRate: rateSchema.videoCallRate.default(200),
    chatMessageRate: rateSchema.chatMessageRate.default(1),

    isVerified: Joi.boolean().default(true),
  })
    .unknown(true)
    .prefs({ convert: true, abortEarly: false }),
};

// ============================================
// SELF — Update My Profile (without rates — rates ka alag endpoint hai)
// ============================================
const updateMyProfile = {
  body: Joi.object({
    isAvailable: Joi.boolean(),
    acceptChat: Joi.boolean(),
    acceptCalls: Joi.boolean(),
    categories: Joi.array().items(Joi.string()),
    languages: Joi.array().items(Joi.string()),
    specialties: Joi.array().items(Joi.string()),
    about: Joi.string().max(500).allow('', null),
    instagramUrl: Joi.string().allow('', null),
    youtubeUrl: Joi.string().allow('', null),
    twitterUrl: Joi.string().allow('', null),

    // ⭐ Rates can still be passed (will be treated as rate change request)
    hourlyRate: rateSchema.hourlyRate,
    videoCallRate: rateSchema.videoCallRate,
    chatMessageRate: rateSchema.chatMessageRate,
  })
    .unknown(true)
    .min(1)
    .prefs({ convert: true, abortEarly: false }),
};

// ============================================
// ⭐ ADMIN — Approve/Reject Rate Change
// ============================================
const processRateChange = {
  body: Joi.object({
    action: Joi.string().valid('APPROVED', 'REJECTED').required(),
  }),
  params: Joi.object({
    id: Joi.string().required(),
  }),
};

// ============================================
// ADMIN — Approve/Reject Girl Request
// ============================================
const processGirlRequest = {
  body: Joi.object({
    action: Joi.string().valid('APPROVED', 'REJECTED').required(),
    rejectionReason: Joi.string().max(500).allow('', null),
  }),
  params: Joi.object({
    id: Joi.string().required(),
  }),
};

// ============================================
// ADMIN — Verify Girl
// ============================================
const verifyGirl = {
  body: Joi.object({
    status: Joi.string().valid('APPROVED', 'REJECTED').required(),
  }),
  params: Joi.object({
    id: Joi.string().required(),
  }),
};

// ============================================
// ADMIN — Update Girl
// ============================================
const updateGirl = {
  body: Joi.object({
    isAvailable: Joi.boolean(),
    isOnline: Joi.boolean(),
    acceptChat: Joi.boolean(),
    acceptCalls: Joi.boolean(),
    isVerified: Joi.boolean(),
    isFeatured: Joi.boolean(),
    categories: Joi.array().items(Joi.string().max(50)),
    languages: Joi.array().items(Joi.string().max(50)),
    specialties: Joi.array().items(Joi.string().max(50)),
    about: Joi.string().max(1000).allow(''),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'BLOCKED'),
    rateApproved: Joi.boolean(),

    // ⭐ Admin can directly override rates
    hourlyRate: rateSchema.hourlyRate,
    videoCallRate: rateSchema.videoCallRate,
    chatMessageRate: rateSchema.chatMessageRate,
  })
    .min(1)
    .prefs({ convert: true, abortEarly: false }),
};

// ============================================
// PUBLIC — Get Available Girls (with rate filter)
// ============================================
const getAvailableGirls = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    category: Joi.string(),
    language: Joi.string(),
    search: Joi.string().max(100),
    minRating: Joi.number().min(0).max(5),
    maxRating: Joi.number().min(0).max(5),

    // ⭐ Rate filters
    minRate: Joi.number().min(0),
    maxRate: Joi.number().min(0),

    // ⭐ Sort
    sortBy: Joi.string().valid(
      'rating',
      'priceLow',
      'priceHigh',
      'earnings',
      'newest'
    ),

    onlineOnly: Joi.boolean(),
  }),
};

// ============================================
// ADMIN — Get All Girls (with filters)
// ============================================
const getAllGirls = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().max(100).allow(''),
    isVerified: Joi.boolean(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED'),
    rateApproved: Joi.boolean(),
  }),
};

// ============================================
// Exports
// ============================================
module.exports = {
  createMyProfile,
  createGirlProfile,
  updateMyProfile,
  updateMyRates,           // ⭐ NEW
  processRateChange,       // ⭐ NEW
  processGirlRequest,
  verifyGirl,
  updateGirl,
  getAvailableGirls,       // ⭐ NEW
  getAllGirls,             // ⭐ NEW
};