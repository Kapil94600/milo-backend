// ============================================
// User Routes
// ============================================

const express = require('express');
const UserController = require('../controllers/user.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const UserValidator = require('../validators/user.validator');
const { limiter } = require('../middleware/rateLimiter');
const { uploadImage, handleMulterError } = require('../middleware/upload');

const router = express.Router();

// ============================================
// All routes require authentication
// ============================================
router.use(authenticate);

// ============================================
// Own profile routes (MUST come before /:id)
// ============================================

// GET /users/profile
router.get('/profile', UserController.getProfile);

// GET /users/stats
router.get('/stats', UserController.getStats);

// ─── PUT /users/profile — supports file upload ───
router.put(
  '/profile',
  uploadImage.fields([
    { name: 'profileImageFile', maxCount: 1 },
    { name: 'coverImageFile', maxCount: 1 },
  ]),
  handleMulterError,
  validate(UserValidator.updateProfile),
  UserController.updateProfile
);

// PUT /users/settings
router.put('/settings', validate(UserValidator.updateSettings), UserController.updateSettings);

// POST /users/device-token
router.post('/device-token', validate(UserValidator.addDeviceToken), UserController.addDeviceToken);

// DELETE /users/device-token
router.delete('/device-token', validate(UserValidator.removeDeviceToken), UserController.removeDeviceToken);

// PUT /users/online-status
router.put('/online-status', validate(UserValidator.updateOnlineStatus), UserController.updateOnlineStatus);

// GET /users/nearby
router.get('/nearby', validate(UserValidator.getNearbyUsers), limiter, UserController.getNearbyUsers);

// DELETE /users/delete-account
router.delete('/delete-account', UserController.deleteAccount);

// ============================================
// Admin routes
// ============================================

// GET /users (admin only)
router.get('/', requireAdmin, validate(UserValidator.getAllUsers), UserController.getAllUsers);

// ============================================
// Dynamic routes (MUST be LAST)
// ============================================
router.get('/:id', UserController.getUserById);

module.exports = router;