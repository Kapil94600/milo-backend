// ============================================
// Girl Routes — Complete with Rate Management
// ============================================

const express = require('express');
const GirlController = require('../controllers/girl.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const GirlValidator = require('../validators/girl.validator');
const { uploadImage, handleMulterError } = require('../middleware/upload');

const router = express.Router();

// Folder setter
const setVerificationFolder = (req, res, next) => {
  req.uploadFolder = 'verification';
  next();
};

// ============================================
// PUBLIC routes
// ============================================
router.get(
  '/available',
  validate(GirlValidator.getAvailableGirls),
  GirlController.getAvailableGirls
);

router.get('/top', GirlController.getTopGirls);

// ============================================
// AUTHENTICATED routes
// ============================================
router.use(authenticate);

// ─── Onboarding — Submit Request ───
router.post(
  '/request',
  validate(GirlValidator.createMyProfile),
  GirlController.submitGirlRequest
);

// ─── Get my request status ───
router.get('/request/me', GirlController.getMyGirlRequest);

// ============================================
// SELF — Girl Profile routes
// ============================================

// Create profile directly (legacy)
router.post(
  '/profile/me',
  validate(GirlValidator.createMyProfile),
  GirlController.createMyProfile
);

// Get my girl profile
router.get('/profile/me', GirlController.getMyProfile);

// Update my girl profile
router.put(
  '/profile/me',
  validate(GirlValidator.updateMyProfile),
  GirlController.updateMyProfile
);

// ⭐ NEW: Get my rates
router.get('/profile/rates', GirlController.getMyRates);

// ⭐ NEW: Update my rates (pending admin approval)
router.put(
  '/profile/rates',
  validate(GirlValidator.updateMyRates),
  GirlController.updateMyRates
);

// Online status
router.put('/profile/online', GirlController.updateOnlineStatus);

// Availability
router.put('/profile/availability', GirlController.updateAvailability);

// Verification documents — supports file upload
router.post(
  '/profile/verification',
  setVerificationFolder,
  uploadImage.fields([
    { name: 'idProofFile', maxCount: 1 },
    { name: 'selfieFile', maxCount: 1 },
  ]),
  handleMulterError,
  GirlController.uploadVerificationDocuments
);

// Earnings
router.get('/profile/earnings', GirlController.getEarnings);

// Delete my profile
router.delete('/profile/me', GirlController.deleteMyProfile);

// ============================================
// ADMIN — Girl Requests
// ============================================
router.get('/admin/requests', requireAdmin, GirlController.getAllGirlRequests);

router.put(
  '/admin/requests/:id',
  requireAdmin,
  validate(GirlValidator.processGirlRequest),
  GirlController.processGirlRequest
);

// ============================================
// ⭐ ADMIN — Rate Change Requests
// ============================================
router.get(
  '/admin/rate-requests',
  requireAdmin,
  GirlController.getPendingRateChanges
);

router.put(
  '/admin/rate-requests/:id',
  requireAdmin,
  validate(GirlValidator.processRateChange),
  GirlController.processRateChange
);

// ============================================
// ADMIN — Girls Management
// ============================================

// Create girl directly
router.post(
  '/',
  requireAdmin,
  validate(GirlValidator.createGirlProfile),
  GirlController.createGirlProfile
);

// Get all girls (with filters)
router.get(
  '/',
  requireAdmin,
  validate(GirlValidator.getAllGirls),
  GirlController.getAllGirls
);

// Verify girl
router.put(
  '/admin/:id/verify',
  requireAdmin,
  validate(GirlValidator.verifyGirl),
  GirlController.verifyGirl
);
// ⭐ NEW: Check if user can request to become girl
router.get(
  '/request/can-request',
  GirlController.canRequestGirl
);

// ⭐ NEW: Cancel pending request
router.delete(
  '/request/me',
  GirlController.cancelGirlRequest
);

// Update girl
router.put(
  '/admin/:id',
  requireAdmin,
  validate(GirlValidator.updateGirl),
  GirlController.updateGirl
);

// Delete girl
router.delete('/admin/:id', requireAdmin, GirlController.deleteGirl);

// ============================================
// DYNAMIC routes — LAST
// ============================================
router.get('/user/:userId', GirlController.getGirlByUserId);
router.get('/:id', GirlController.getGirlProfileById);

module.exports = router;