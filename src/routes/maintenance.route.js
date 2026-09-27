// ============================================
// Maintenance Routes
// ============================================

const express = require('express');
const MaintenanceController = require('../controllers/maintenance.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const Joi = require('joi');

const router = express.Router();

// ============================================
// PUBLIC
// ============================================
router.get('/status', MaintenanceController.getStatus);

// ============================================
// ADMIN — all below require auth + admin
// ============================================
router.use(authenticate, requireAdmin);

// Enable maintenance
router.post(
  '/enable',
  validate({
    body: Joi.object({
      message: Joi.string().max(500).required(),
      type: Joi.string().valid('SCHEDULED', 'EMERGENCY', 'UPDATE').default('SCHEDULED'),
      scheduledStart: Joi.date().iso().allow(null),
      scheduledEnd: Joi.date().iso().allow(null),
      affectedServices: Joi.array().items(Joi.string()).default(['ALL']),
    }),
  }),
  MaintenanceController.enable
);

// Disable maintenance
router.post('/disable', MaintenanceController.disable);

// Update message only
router.put(
  '/message',
  validate({
    body: Joi.object({
      message: Joi.string().max(500).required(),
    }),
  }),
  MaintenanceController.updateMessage
);

// History
router.get('/history', MaintenanceController.getHistory);

module.exports = router;