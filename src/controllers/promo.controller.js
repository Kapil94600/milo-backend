// ============================================
// Promo Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const PromoService = require('../services/promo.service');
const ApiResponse = require('../utils/response');

// ============================================
// USER
// ============================================

// GET /promos/validate/:code
const validatePromo = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { amount } = req.query;
  const result = await PromoService.validatePromo(
    code,
    req.user.id,
    parseFloat(amount) || 0
  );
  return ApiResponse.success(res, result, 'Promo validated');
});

// POST /promos/apply/:code
const applyPromo = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { amount, orderId } = req.body;
  const result = await PromoService.applyPromo(
    code,
    req.user.id,
    parseFloat(amount) || 0,
    orderId
  );
  return ApiResponse.success(res, result, 'Promo applied');
});

// ============================================
// ADMIN
// ============================================

// POST /promos — with optional file upload
const createPromo = asyncHandler(async (req, res) => {
  const data = { ...req.body };

  // Attach uploaded image (if multipart)
  if (req.file) {
    data._uploadedFile = req.file;
  }

  const promo = await PromoService.createPromo(data, req.user.id);
  return ApiResponse.created(res, promo, 'Promo created');
});

// GET /promos
const getPromos = asyncHandler(async (req, res) => {
  const { page, limit, isActive, type, search } = req.query;
  const result = await PromoService.getPromos({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
    type: type || undefined,
    search: search || undefined,
  });
  return ApiResponse.success(res, result, 'Promos fetched');
});

// GET /promos/:id
const getPromoById = asyncHandler(async (req, res) => {
  const promo = await PromoService.getPromoById(req.params.id);
  return ApiResponse.success(res, promo, 'Promo fetched');
});

// PUT /promos/:id — with optional file upload
const updatePromo = asyncHandler(async (req, res) => {
  const data = { ...req.body };

  // Attach uploaded image (if multipart)
  if (req.file) {
    data._uploadedFile = req.file;
  }

  const promo = await PromoService.updatePromo(req.params.id, data);
  return ApiResponse.success(res, promo, 'Promo updated');
});

// DELETE /promos/:id
const deletePromo = asyncHandler(async (req, res) => {
  const promo = await PromoService.deletePromo(req.params.id);
  return ApiResponse.success(res, promo, 'Promo deleted');
});

// PUT /promos/:id/toggle
const toggleStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const promo = await PromoService.togglePromoStatus(req.params.id, isActive);
  return ApiResponse.success(
    res,
    promo,
    `Promo ${isActive ? 'activated' : 'deactivated'}`
  );
});

// GET /promos/admin/stats
const getStats = asyncHandler(async (req, res) => {
  const stats = await PromoService.getStats();
  return ApiResponse.success(res, stats, 'Promo stats fetched');
});

// ============================================
// Exports
// ============================================
module.exports = {
  validatePromo,
  applyPromo,
  createPromo,
  getPromos,
  getPromoById,
  updatePromo,
  deletePromo,
  toggleStatus,
  getStats,
};