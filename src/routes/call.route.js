// ============================================
// Call Routes (Bond) — Complete
// ============================================

const express = require('express');
const CallController = require('../controllers/call.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const CallValidator = require('../validators/call.validator');

const router = express.Router();

router.use(authenticate);

// ============================================
// SPECIFIC routes FIRST
// ============================================

router.get('/history', validate(CallValidator.getCallHistory), CallController.getCallHistory);
router.get('/active', CallController.getActiveCall);
router.get('/missed', CallController.getMissedCalls);
router.get('/stats', CallController.getCallStats);
router.get('/rates', CallController.getCallRates);
router.get('/video-eligibility', CallController.getVideoEligibility);

// ⭐ NEW: Admin — get all calls
router.get(
  '/admin/all',
  requireAdmin,
  CallController.getAllCalls
);

// Admin routes
router.put(
  '/admin/rates',
  requireAdmin,
  validate(CallValidator.updateCallRates),
  CallController.updateCallRates
);

// ============================================
// Initiate call
// ============================================
router.post('/initiate', validate(CallValidator.initiateCall), CallController.initiateCall);

// ============================================
// Dynamic routes LAST
// ============================================

router.get('/:callId', CallController.getCallById);
router.put('/:callId/accept', CallController.acceptCall);
router.put('/:callId/reject', CallController.rejectCall);
router.put('/:callId/cancel', CallController.cancelCall);
router.put('/:callId/end', CallController.endCall);
router.post('/:callId/recording', validate(CallValidator.saveRecording), CallController.saveRecording);

module.exports = router;