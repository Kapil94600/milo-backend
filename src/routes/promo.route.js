// ============================================
// Promo Routes
// ============================================

const express = require('express');
const PromoController = require('../controllers/promo.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const PromoValidator = require('../validators/promo.validator');
const { uploadImage, handleMulterError } = require('../middleware/upload');

const router = express.Router();

// Folder setter
const setPromoFolder = (req, res, next) => {
  req.uploadFolder = 'promos';
  next();
};

// ============================================
// USER routes
// ============================================
router.use(authenticate);

router.get(
  '/validate/:code',
  validate(PromoValidator.validatePromo),
  PromoController.validatePromo
);

router.post(
  '/apply/:code',
  validate(PromoValidator.applyPromo),
  PromoController.applyPromo
);

// ============================================
// ADMIN routes
// ============================================

// Create promo — supports optional image file
router.post(
  '/',
  requireAdmin,
  setPromoFolder,
  uploadImage.single('imageFile'),
  handleMulterError,
  validate(PromoValidator.createPromo),
  PromoController.createPromo
);

router.get('/', requireAdmin, PromoController.getPromos);
router.get('/admin/stats', requireAdmin, PromoController.getStats);

// Update promo — supports optional image file
router.put(
  '/:id',
  requireAdmin,
  setPromoFolder,
  uploadImage.single('imageFile'),
  handleMulterError,
  validate(PromoValidator.updatePromo),
  PromoController.updatePromo
);

router.delete('/:id', requireAdmin, PromoController.deletePromo);
router.put(
  '/:id/toggle',
  requireAdmin,
  validate(PromoValidator.toggleStatus),
  PromoController.toggleStatus
);

// ============================================
// Dynamic LAST
// ============================================
router.get('/:id', requireAdmin, PromoController.getPromoById);

module.exports = router;