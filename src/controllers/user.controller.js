// ============================================
// User Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const UserService = require('../services/user.service');
const ApiResponse = require('../utils/response');

// ============================================
// GET /users/profile
// ============================================
const getProfile = asyncHandler(async (req, res) => {
  const user = await UserService.getProfile(req.user.id);
  return ApiResponse.success(res, user, 'Profile fetched');
});

// ============================================
// GET /users/stats
// ============================================
const getStats = asyncHandler(async (req, res) => {
  const stats = await UserService.getUserStats(req.user.id);
  return ApiResponse.success(res, stats, 'Stats fetched');
});

// ============================================
// PUT /users/profile
// ============================================
// ============================================
// PUT /users/profile — supports file upload
// ============================================
const updateProfile = asyncHandler(async (req, res) => {
  const data = { ...req.body };

  // Attach uploaded files (if multipart)
  if (req.files) {
    if (req.files.profileImageFile?.[0]) {
      data.profileImageFile = req.files.profileImageFile[0];
    }
    if (req.files.coverImageFile?.[0]) {
      data.coverImageFile = req.files.coverImageFile[0];
    }
  }

  const user = await UserService.updateProfile(req.user.id, data);
  return ApiResponse.success(res, user, 'Profile updated successfully');
});
// ============================================
// PUT /users/settings
// ============================================
const updateSettings = asyncHandler(async (req, res) => {
  const settings = await UserService.updateSettings(req.user.id, req.body);
  return ApiResponse.success(res, settings, 'Settings updated');
});

// ============================================
// POST /users/device-token
// ============================================
const addDeviceToken = asyncHandler(async (req, res) => {
  const { token, platform, deviceInfo } = req.body;
  const result = await UserService.addDeviceToken(
    req.user.id,
    token,
    platform,
    deviceInfo || {}
  );
  return ApiResponse.success(res, result, 'Device registered');
});

// ============================================
// DELETE /users/device-token
// ============================================
const removeDeviceToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const result = await UserService.removeDeviceToken(req.user.id, token);
  return ApiResponse.success(res, result, 'Device removed');
});

// ============================================
// PUT /users/online-status
// ============================================
const updateOnlineStatus = asyncHandler(async (req, res) => {
  const { isOnline } = req.body;
  const result = await UserService.updateOnlineStatus(req.user.id, isOnline);
  return ApiResponse.success(res, result, 'Status updated');
});

// ============================================
// GET /users/nearby
// ============================================
const getNearbyUsers = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 10 } = req.query;
  const users = await UserService.getNearbyUsers(
    req.user.id,
    parseFloat(lat),
    parseFloat(lng),
    parseFloat(radius)
  );
  return ApiResponse.success(res, users, 'Nearby users fetched');
});

// ============================================
// GET /users/:id
// ============================================
const getUserById = asyncHandler(async (req, res) => {
  const user = await UserService.getUserById(req.params.id, req.user.id);
  return ApiResponse.success(res, user, 'User fetched');
});

// ============================================
// GET /users (admin)
// ============================================
const getAllUsers = asyncHandler(async (req, res) => {
  const { page, limit, search, role, status } = req.query;
  const result = await UserService.getAllUsers({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    search: search || '',
    role: role || null,
    status: status || null,
  });
  return ApiResponse.success(res, result, 'Users fetched');
});

// ============================================
// DELETE /users/delete-account
// ============================================
const deleteAccount = asyncHandler(async (req, res) => {
  const result = await UserService.deleteAccount(req.user.id);
  return ApiResponse.success(res, result, 'Account deleted');
});

// ============================================
// Exports
// ============================================
module.exports = {
  getProfile,
  getStats,
  updateProfile,
  updateSettings,
  addDeviceToken,
  removeDeviceToken,
  updateOnlineStatus,
  getNearbyUsers,
  getUserById,
  getAllUsers,
  deleteAccount,
};