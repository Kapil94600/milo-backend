// ============================================
// Request Validation (Joi)
// ============================================

const Joi = require('joi');
const AppError = require('../utils/AppError');

// ============================================
// Validation middleware factory
// ============================================
const validate = (schemas = {}) => {
  return (req, res, next) => {
    const errors = [];

    for (const key of ['body', 'query', 'params']) {
      if (!schemas[key]) continue;

      const schema = schemas[key];
      const value = req[key];

      const { error, value: validated } = schema.validate(value, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        const details = error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message.replace(/['"]/g, ''),
        }));
        errors.push(...details);
      } else {
        req[key] = validated;
      }
    }

    if (errors.length > 0) {
      return next(AppError.validation('Validation failed', errors));
    }

    next();
  };
};

// ============================================
// Common Joi schemas / shortcuts
// ============================================
const J = {
  string: Joi.string().trim(),
  phone: Joi.string().pattern(/^\d{10,15}$/).message('Invalid phone number'),
  email: Joi.string().email().lowercase().trim(),
  password: Joi.string().min(6).max(100),
  otp: Joi.string().pattern(/^\d{6}$/).message('OTP must be 6 digits'),
  uuid: Joi.string().uuid({ version: ['uuidv4', 'uuidv5'] }),
  cuid: Joi.string().min(20).max(30),
  id: Joi.string().min(10).max(40), // flexible — Prisma cuid
  positiveInt: Joi.number().integer().positive(),
  nonNegativeInt: Joi.number().integer().min(0),
  positiveNumber: Joi.number().positive(),
  nonNegativeNumber: Joi.number().min(0),
  boolean: Joi.boolean(),
  date: Joi.date().iso(),
  array: (itemSchema) => Joi.array().items(itemSchema),
  objectId: Joi.string().length(24).hex(),
  url: Joi.string().uri(),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  },
};

module.exports = {
  validate,
  J,
  Joi,
};