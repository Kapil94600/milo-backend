// ============================================
// Banner Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const BannerService = require('../services/banner.service');
const ApiResponse = require('../utils/response');

// ============================================
// PUBLIC
// ============================================
const getActiveBanners = asyncHandler(async (req, res) => {
  const { platform = 'ALL', role = 'USER' } = req.query;
  const banners = await BannerService.getActiveBanners({ platform, role });
  return ApiResponse.success(res, banners, 'Active banners fetched');
});

const getBannerById = asyncHandler(async (req, res) => {
  const banner = await BannerService.getBannerById(req.params.id);
  return ApiResponse.success(res, banner, 'Banner fetched');
});

const trackClick = asyncHandler(async (req, res) => {
  const banner = await BannerService.trackClick(req.params.id);
  return ApiResponse.success(res, { clickCount: banner.clickCount }, 'Click tracked');
});

const trackView = asyncHandler(async (req, res) => {
  const banner = await BannerService.trackView(req.params.id);
  return ApiResponse.success(res, { viewCount: banner.viewCount }, 'View tracked');
});

// ============================================
// ADMIN — Create Banner (with file upload support)
// ============================================
const createBanner = asyncHandler(async (req, res) => {
  console.log('📥 [Banner Create] req.body:', req.body);
  console.log('📁 [Banner Create] req.file:', req.file);

  const data = { ...req.body };

  // ✅ Attach uploaded file
  if (req.file) {
    data._uploadedFile = req.file;
  }

  const banner = await BannerService.createBanner(data, req.user.id);
  return ApiResponse.created(res, banner, 'Banner created');
});

// ============================================
// ADMIN — Get All Banners
// ============================================
const getAllBanners = asyncHandler(async (req, res) => {
  const { page, limit, isActive, search } = req.query;
  const result = await BannerService.getAllBanners({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
    search,
  });
  return ApiResponse.success(res, result, 'Banners fetched');
});

// ============================================
// ADMIN — Update Banner (with file upload support)
// ============================================
const updateBanner = asyncHandler(async (req, res) => {
  console.log('📥 [Banner Update] req.body:', req.body);
  console.log('📁 [Banner Update] req.file:', req.file);

  const data = { ...req.body };

  if (req.file) {
    data._uploadedFile = req.file;
  }

  const banner = await BannerService.updateBanner(
    req.params.id,
    data,
    req.user.id
  );
  return ApiResponse.success(res, banner, 'Banner updated');
});

// ============================================
// ADMIN — Delete Banner
// ============================================
const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await BannerService.deleteBanner(req.params.id);
  return ApiResponse.success(res, banner, 'Banner deleted');
});

// ============================================
// ADMIN — Toggle Banner
// ============================================
const toggleBanner = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const banner = await BannerService.toggleBanner(req.params.id, isActive);
  return ApiResponse.success(
    res,
    banner,
    `Banner ${isActive ? 'activated' : 'deactivated'}`
  );
});

// ============================================
// ADMIN — Reorder Banners
// ============================================
const reorderBanners = asyncHandler(async (req, res) => {
  const { orders } = req.body;
  const result = await BannerService.reorderBanners(orders);
  return ApiResponse.success(res, result, 'Banners reordered');
});

// ============================================
// ADMIN — Stats
// ============================================
const getStats = asyncHandler(async (req, res) => {
  const stats = await BannerService.getStats();
  return ApiResponse.success(res, stats, 'Stats fetched');
});

// ============================================
// Exports
// ============================================
module.exports = {
  getActiveBanners,
  getBannerById,
  trackClick,
  trackView,
  createBanner,
  getAllBanners,
  updateBanner,
  deleteBanner,
  toggleBanner,
  reorderBanners,
  getStats,
};