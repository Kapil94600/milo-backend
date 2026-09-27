// ============================================
// Banner Routes
// ============================================

const express = require('express');
const BannerController = require('../controllers/banner.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const BannerValidator = require('../validators/banner.validator');
const { uploadImage, handleMulterError } = require('../middleware/upload');

const router = express.Router();

// Folder setter
const setBannerFolder = (req, res, next) => {
  req.uploadFolder = 'banners';
  next();
};

// ============================================
// PUBLIC
// ============================================
router.get('/active', BannerController.getActiveBanners);

// ============================================
// AUTHENTICATED
// ============================================
router.use(authenticate);

// ─── Admin: Specific routes FIRST ───
router.get('/admin/all', requireAdmin, validate(BannerValidator.paginationQuery), BannerController.getAllBanners);
router.get('/admin/stats', requireAdmin, BannerController.getStats);

// ─── Create banner (support multipart) ───
router.post(
  '/admin',
  requireAdmin,
  setBannerFolder,
  uploadImage.single('imageFile'),  // optional file
  handleMulterError,
  validate(BannerValidator.createBanner),
  BannerController.createBanner
);

router.post('/admin/reorder', requireAdmin, validate(BannerValidator.reorderBanners), BannerController.reorderBanners);

// ─── Track ───
router.post('/:id/view', BannerController.trackView);
router.post('/:id/click', BannerController.trackClick);

// ─── Update banner (support multipart) ───
router.put(
  '/:id',
  requireAdmin,
  setBannerFolder,
  uploadImage.single('imageFile'),  // optional file
  handleMulterError,
  validate(BannerValidator.updateBanner),
  BannerController.updateBanner
);

router.delete('/:id', requireAdmin, BannerController.deleteBanner);
router.put('/:id/toggle', requireAdmin, validate(BannerValidator.toggleBanner), BannerController.toggleBanner);

// ─── Public dynamic LAST ───
router.get('/:id', BannerController.getBannerById);

module.exports = router;