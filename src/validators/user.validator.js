// ============================================
// User Validators (Joi)
// ============================================

const Joi = require('joi');
const { J } = require('../middleware/validate');

// PUT /users/profile
// PUT /users/profile
const updateProfile = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(50),
    email: J.email,
    username: Joi.string()
      .trim()
      .lowercase()
      .min(3)
      .max(30)
      .pattern(/^[a-z0-9_]+$/)
      .message('Username: lowercase letters, numbers, underscore only'),
    // image can be provided via file OR url
    profileImage: Joi.string().uri().allow(''),
    coverImage: Joi.string().uri().allow(''),
    bio: Joi.string().max(500).allow(''),
    birthDate: Joi.date().iso(),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'),
    address: Joi.string().max(200).allow(''),
    city: Joi.string().max(100).allow(''),
    country: Joi.string().max(100).allow(''),
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
    language: Joi.string().max(10),
    darkMode: Joi.boolean(),
  })
    .unknown(true) // allow profileImageFile, coverImageFile
    .min(1)
    .prefs({ convert: true, abortEarly: false }),
};

// PUT /users/settings
const updateSettings = {
  body: Joi.object({
    language: Joi.string().max(10),
    darkMode: Joi.boolean(),
  }).min(1),
};

// POST /users/device-token
const addDeviceToken = {
  body: Joi.object({
    token: Joi.string().required().max(500),
    platform: Joi.string().valid('ios', 'android', 'web', 'unknown'),
    deviceInfo: Joi.object({
      deviceId: Joi.string().max(100),
      model: Joi.string().max(50),
      version: Joi.string().max(20),
    }),
  }),
};

// DELETE /users/device-token
const removeDeviceToken = {
  body: Joi.object({
    token: Joi.string().required().max(500),
  }),
};

// PUT /users/online-status
const updateOnlineStatus = {
  body: Joi.object({
    isOnline: Joi.boolean().required(),
  }),
};

// GET /users/nearby
const getNearbyUsers = {
  query: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    radius: Joi.number().min(0.1).max(100).default(10),
  }),
};

// GET /users (admin)
const getAllUsers = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().max(100).allow(''),
    role: Joi.string().valid('USER', 'GIRL', 'ADMIN'),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED'),
  }),
};

module.exports = {
  updateProfile,
  updateSettings,
  addDeviceToken,
  removeDeviceToken,
  updateOnlineStatus,
  getNearbyUsers,
  getAllUsers,
};