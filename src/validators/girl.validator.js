// ============================================
// Girl Validators (Joi) — Onboarding Friendly
// ============================================

const Joi = require('joi');

// ============================================
// ✅ Self — Create My Profile (Onboarding)
// ============================================
const createMyProfile = {
  body: Joi.object({
    about: Joi.string().max(500).allow('', null),
    categories: Joi.array().items(Joi.string()).default([]),
    languages: Joi.array().items(Joi.string()).default([]),
    specialties: Joi.array().items(Joi.string()).default([]),
    hourlyRate: Joi.number().min(0).default(100),
  })
    .unknown(true)
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
    hourlyRate: Joi.number().min(0).default(100),
    isVerified: Joi.boolean().default(true),
  })
    .unknown(true)
    .prefs({ convert: true, abortEarly: false }),
};

// ============================================
// Self — Update My Profile
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
    hourlyRate: Joi.number().min(0),
    instagramUrl: Joi.string().allow('', null),
    youtubeUrl: Joi.string().allow('', null),
    twitterUrl: Joi.string().allow('', null),
  })
    .unknown(true)
    .min(1)
    .prefs({ convert: true, abortEarly: false }),
};

module.exports = {
  createMyProfile,        // ✅ Naya — Onboarding ke liye
  createGirlProfile,      // Admin ke liye
  updateMyProfile,
};