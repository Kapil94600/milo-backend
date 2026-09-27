// ============================================
// Audit Routes
// ============================================

const express = require('express');
const AuditController = require('../controllers/audit.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const AuditValidator = require('../validators/audit.validator');

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('/stats', AuditController.getStats);
router.get('/user/:userId', validate(AuditValidator.paginationQuery), AuditController.getUserLogs);
router.get('/', validate(AuditValidator.getLogs), AuditController.getLogs);
router.delete('/cleanup', AuditController.cleanup);

module.exports = router;