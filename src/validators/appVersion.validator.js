// ============================================
// App Version Validators (Joi)
// ============================================

const Joi = require('joi');

const checkVersion = {
  body: Joi.object({
    platform: Joi.string().valid('ANDROID', 'IOS', 'WEB').required(),
    version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(),
  }),
};

const createVersion = {
  body: Joi.object({
    version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(),
    platform: Joi.string().valid('ANDROID', 'IOS', 'WEB').required(),
    minVersion: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(),
    requiredVersion: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(),
    downloadUrl: Joi.string().uri().allow(''),
    releaseNotes: Joi.string().max(2000).allow(''),
    isMandatory: Joi.boolean().default(false),
    isLatest: Joi.boolean().default(true),
  }),
};

const updateVersion = {
  body: Joi.object({
    version: Joi.string().pattern(/^\d+\.\d+\.\d+$/),
    minVersion: Joi.string().pattern(/^\d+\.\d+\.\d+$/),
    requiredVersion: Joi.string().pattern(/^\d+\.\d+\.\d+$/),
    downloadUrl: Joi.string().uri().allow(''),
    releaseNotes: Joi.string().max(2000).allow(''),
    isMandatory: Joi.boolean(),
    isLatest: Joi.boolean(),
  }).min(1),
};

const paginationQuery = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    platform: Joi.string().valid('ANDROID', 'IOS', 'WEB'),
  }),
};

module.exports = { checkVersion, createVersion, updateVersion, paginationQuery };