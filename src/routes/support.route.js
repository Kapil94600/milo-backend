// ============================================
// Support Routes
// ============================================

const express = require('express');
const SupportController = require('../controllers/support.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const SupportValidator = require('../validators/support.validator');

const router = express.Router();

router.use(authenticate);

// ============================================
// USER — SPECIFIC first
// ============================================
router.post('/', validate(SupportValidator.createTicket), SupportController.createTicket);
router.get('/my-tickets', SupportController.getMyTickets);

// ============================================
// ADMIN — SPECIFIC first
// ============================================
router.get('/admin/stats', requireAdmin, SupportController.getStats);
router.get('/', requireAdmin, SupportController.getTickets);

// ============================================
// Dynamic LAST
// ============================================
router.get('/:id', SupportController.getTicketById);
router.post('/:id/message', validate(SupportValidator.addMessage), SupportController.addMessage);
router.put('/:id/rate', validate(SupportValidator.rateTicket), SupportController.rateTicket);

// Admin actions
router.put('/:id/status', requireAdmin, validate(SupportValidator.updateStatus), SupportController.updateStatus);
router.put('/:id/assign', requireAdmin, validate(SupportValidator.assignTicket), SupportController.assignTicket);
router.delete('/:id', requireAdmin, SupportController.deleteTicket);

module.exports = router;