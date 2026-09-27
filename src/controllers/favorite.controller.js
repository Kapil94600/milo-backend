// ============================================
// Favorite Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const FavoriteService = require('../services/favorite.service');
const ApiResponse = require('../utils/response');

const addFavorite = asyncHandler(async (req, res) => {
  const { favoriteId, notes } = req.body;
  const fav = await FavoriteService.addFavorite(req.user.id, favoriteId, notes);
  return ApiResponse.created(res, fav, 'Added to favorites');
});

const removeFavorite = asyncHandler(async (req, res) => {
  const fav = await FavoriteService.removeFavorite(req.user.id, req.params.favoriteId);
  return ApiResponse.success(res, fav, 'Removed from favorites');
});

const getMyFavorites = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await FavoriteService.getMyFavorites(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return ApiResponse.success(res, result, 'Favorites fetched');
});

const checkFavorite = asyncHandler(async (req, res) => {
  const isFavorite = await FavoriteService.isFavorite(req.user.id, req.params.favoriteId);
  return ApiResponse.success(res, { isFavorite });
});

const getCount = asyncHandler(async (req, res) => {
  const count = await FavoriteService.getCount(req.user.id);
  return ApiResponse.success(res, { count });
});

const updateNotes = asyncHandler(async (req, res) => {
  const fav = await FavoriteService.updateNotes(req.user.id, req.params.favoriteId, req.body.notes);
  return ApiResponse.success(res, fav, 'Notes updated');
});

module.exports = {
  addFavorite,
  removeFavorite,
  getMyFavorites,
  checkFavorite,
  getCount,
  updateNotes,
};