// ============================================
// Upload Routes — Bond (Complete)
// ============================================

const express = require('express');
const UploadController = require('../controllers/upload.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  uploadImage: uploadImageMw,
  uploadChatMedia,
  handleMulterError,
} = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ============================================
// Folder setter
// ============================================
const setFolder = (folder) => (req, res, next) => {
  req.uploadFolder = folder;
  next();
};

// ============================================
// All routes require authentication
// ============================================
router.use(authenticate);

// ─── Generic ───
router.post(
  '/image',
  uploadLimiter,
  setFolder('temp'),
  uploadImageMw.single('image'),
  handleMulterError,
  UploadController.uploadImage
);

router.post(
  '/images',
  uploadLimiter,
  setFolder('temp'),
  uploadImageMw.array('images', 5),
  handleMulterError,
  UploadController.uploadImages
);

// ─── Profile / Cover ───
router.post(
  '/profile',
  uploadLimiter,
  setFolder('profiles'),
  uploadImageMw.single('image'),
  handleMulterError,
  UploadController.uploadImage
);

router.post(
  '/cover',
  uploadLimiter,
  setFolder('covers'),
  uploadImageMw.single('image'),
  handleMulterError,
  UploadController.uploadImage
);

// ─── Verification docs ───
router.post(
  '/verification',
  uploadLimiter,
  setFolder('verification'),
  uploadImageMw.single('file'),
  handleMulterError,
  UploadController.uploadImage
);

// ⭐ CHAT MEDIA (image / video / audio) — NEW filter
router.post(
  '/chat',
  uploadLimiter,
  setFolder('chats'),
  uploadChatMedia.single('file'),
  handleMulterError,
  UploadController.uploadImage
);

// ⭐ AUDIO only (legacy, kept for backward compat)
router.post(
  '/audio',
  uploadLimiter,
  setFolder('chats'),
  uploadChatMedia.single('file'),
  handleMulterError,
  UploadController.uploadImage
);

// ============================================
// ADMIN-only uploads
// ============================================
router.post(
  '/banner',
  requireAdmin,
  uploadLimiter,
  setFolder('banners'),
  uploadImageMw.single('image'),
  handleMulterError,
  UploadController.uploadImage
);

router.post(
  '/gift',
  requireAdmin,
  uploadLimiter,
  setFolder('gifts'),
  uploadImageMw.single('image'),
  handleMulterError,
  UploadController.uploadImage
);

router.post(
  '/promo-image',
  requireAdmin,
  uploadLimiter,
  setFolder('promos'),
  uploadImageMw.single('image'),
  handleMulterError,
  UploadController.uploadImage
);

router.post(
  '/coin-package-image',
  requireAdmin,
  uploadLimiter,
  setFolder('coin-packages'),
  uploadImageMw.single('image'),
  handleMulterError,
  UploadController.uploadImage
);

// ============================================
// Delete
// ============================================
router.delete('/:publicId', UploadController.deleteFile);

module.exports = router;