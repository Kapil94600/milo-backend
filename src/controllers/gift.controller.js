// ============================================
// Gift Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const GiftService = require('../services/gift.service');
const ApiResponse = require('../utils/response');

// ============================================
// PUBLIC / USER
// ============================================

// GET /gifts/active
const getActiveGifts = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const gifts = await GiftService.getActiveGifts(category || null);
  return ApiResponse.success(res, gifts, 'Active gifts fetched');
});

// GET /gifts/top
const getTopGifts = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const gifts = await GiftService.getTopGifts(parseInt(limit) || 10);
  return ApiResponse.success(res, gifts, 'Top gifts fetched');
});

// GET /gifts/category/:category
const getByCategory = asyncHandler(async (req, res) => {
  const gifts = await GiftService.getGiftsByCategory(req.params.category);
  return ApiResponse.success(res, gifts, 'Gifts fetched');
});

// GET /gifts/rarity/:rarity
const getByRarity = asyncHandler(async (req, res) => {
  const gifts = await GiftService.getGiftsByRarity(req.params.rarity);
  return ApiResponse.success(res, gifts, 'Gifts fetched');
});

// GET /gifts/:id
const getGiftById = asyncHandler(async (req, res) => {
  const gift = await GiftService.getGiftById(req.params.id);
  return ApiResponse.success(res, gift, 'Gift fetched');
});

// ============================================
// TRANSACTIONS
// ============================================

// POST /gifts/send
const sendGift = asyncHandler(async (req, res) => {
  const { receiverId, giftId, message, isAnonymous, chatId } = req.body;
  const result = await GiftService.sendGift(req.user.id, receiverId, giftId, {
    message,
    isAnonymous,
    chatId,
  });
  return ApiResponse.created(res, result, 'Gift sent successfully');
});

// GET /gifts/transactions
const getTransactions = asyncHandler(async (req, res) => {
  const { page, limit, status, type, giftId } = req.query;
  const result = await GiftService.getGiftTransactions(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status: status || undefined,
    type: type || undefined,
    giftId: giftId || undefined,
  });
  return ApiResponse.success(res, result, 'Gift transactions fetched');
});

// GET /gifts/unread
const getUnread = asyncHandler(async (req, res) => {
  const gifts = await GiftService.getUnreadGifts(req.user.id);
  return ApiResponse.success(res, gifts, 'Unread gifts fetched');
});

// PUT /gifts/transactions/:id/read
const markAsRead = asyncHandler(async (req, res) => {
  const gift = await GiftService.markAsRead(req.params.id, req.user.id);
  return ApiResponse.success(res, gift, 'Gift marked as read');
});

// ============================================
// ADMIN
// ============================================

// POST /gifts (admin) — supports file OR url
const createGift = asyncHandler(async (req, res) => {
  const data = { ...req.body };

  // Attach uploaded files (if multipart)
  if (req.files) {
    // Multer fields: imageFile, thumbnailFile, animationFile, soundFile
    if (req.files.imageFile?.[0]) data._uploadedFile = req.files.imageFile[0];
    if (req.files.thumbnailFile?.[0]) data.thumbnailFile = req.files.thumbnailFile[0];
    if (req.files.animationFile?.[0]) data.animationFile = req.files.animationFile[0];
    if (req.files.soundFile?.[0]) data.soundFile = req.files.soundFile[0];
  }

  const gift = await GiftService.createGift(data, req.user.id);
  return ApiResponse.created(res, gift, 'Gift created');
});

// GET /gifts/admin/all (admin list)
const getGifts = asyncHandler(async (req, res) => {
  const { page, limit, isActive, category, rarity, isFeatured, search } = req.query;
  const result = await GiftService.getGifts({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
    category: category || undefined,
    rarity: rarity || undefined,
    isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
    search: search || undefined,
  });
  return ApiResponse.success(res, result, 'Gifts fetched');
});

// PUT /gifts/:id (admin) — supports file OR url
const updateGift = asyncHandler(async (req, res) => {
  const data = { ...req.body };

  // Attach uploaded files (if multipart)
  if (req.files) {
    if (req.files.imageFile?.[0]) data._uploadedFile = req.files.imageFile[0];
    if (req.files.thumbnailFile?.[0]) data.thumbnailFile = req.files.thumbnailFile[0];
    if (req.files.animationFile?.[0]) data.animationFile = req.files.animationFile[0];
    if (req.files.soundFile?.[0]) data.soundFile = req.files.soundFile[0];
  } else if (req.file) {
    data._uploadedFile = req.file;
  }

  const gift = await GiftService.updateGift(req.params.id, data);
  return ApiResponse.success(res, gift, 'Gift updated');
});

// DELETE /gifts/:id (admin)
const deleteGift = asyncHandler(async (req, res) => {
  const gift = await GiftService.deleteGift(req.params.id);
  return ApiResponse.success(res, gift, 'Gift deleted');
});

// PUT /gifts/:id/toggle
const toggleGiftStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const gift = await GiftService.toggleGiftStatus(req.params.id, isActive);
  return ApiResponse.success(
    res,
    gift,
    `Gift ${isActive ? 'activated' : 'deactivated'}`
  );
});

// GET /gifts/admin/stats
const getStats = asyncHandler(async (req, res) => {
  const stats = await GiftService.getGiftStats();
  return ApiResponse.success(res, stats, 'Gift stats fetched');
});
// ============================================
// ⭐ GET /gifts/unread/count (NEW)
// ============================================
const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await GiftService.getUnreadGiftCount(req.user.id);
  return ApiResponse.success(res, result, 'Unread gift count');
});
// ============================================
// Exports
// ============================================
module.exports = {
  // Public/User
  getActiveGifts,
  getTopGifts,
  getByCategory,
  getByRarity,
  getGiftById,
  sendGift,
  getTransactions,
  getUnread,
  markAsRead,

  // Admin
  createGift,
  getGifts,
  updateGift,
  deleteGift,
  toggleGiftStatus,
  getStats,
   getUnreadCount, 
};