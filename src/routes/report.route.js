// ============================================
// Report Routes
// ============================================

const express = require('express');
const ReportController = require('../controllers/report.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ReportValidator = require('../validators/report.validator');

const router = express.Router();

router.use(authenticate);

// ============================================
// USER
// ============================================
router.post('/', validate(ReportValidator.createReport), ReportController.createReport);
router.get('/my-reports', ReportController.getMyReports);

// ============================================
// ADMIN — SPECIFIC first
// ============================================
router.get('/admin/stats', requireAdmin, ReportController.getStats);
router.get('/', requireAdmin, validate(ReportValidator.getReports), ReportController.getReports);

// ============================================
// Dynamic LAST
// ============================================
router.get('/:id', ReportController.getReportById);
router.put('/:id', requireAdmin, validate(ReportValidator.updateReport), ReportController.updateReport);
router.delete('/:id', requireAdmin, ReportController.deleteReport);

module.exports = router;