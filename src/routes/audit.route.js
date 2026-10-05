// ============================================
// Audit Routes — Bond (Complete)
// Note: authenticate + requireAdmin already applied in app.js
// ============================================

const express = require('express');
const AuditController = require('../controllers/audit.controller');
const { validate } = require('../middleware/validate');
const AuditValidator = require('../validators/audit.validator');

const router = express.Router();

// ============================================
// Stats — MUST be before /:anything
// ============================================
router.get('/stats', AuditController.getStats);

// ============================================
// User logs
// ============================================
router.get(
  '/user/:userId',
  validate(AuditValidator.paginationQuery),
  AuditController.getUserLogs
);

// ============================================
// Cleanup — MUST be before /
// ============================================
router.delete('/cleanup', AuditController.cleanup);

// ============================================
// Main list
// ============================================
router.get(
  '/',
  validate(AuditValidator.getLogs),
  AuditController.getLogs
);

module.exports = router;