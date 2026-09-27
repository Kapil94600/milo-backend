// ============================================
// App Version Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const AppVersionService = require('../services/appVersion.service');
const ApiResponse = require('../utils/response');

// Public
const checkVersion = asyncHandler(async (req, res) => {
  const { platform, version } = req.body;
  const result = await AppVersionService.checkVersion(platform, version);
  return ApiResponse.success(res, result, 'Version check complete');
});

const getLatest = asyncHandler(async (req, res) => {
  const version = await AppVersionService.getLatestVersion(req.params.platform);
  return ApiResponse.success(res, version, 'Latest version');
});

// Admin
const createVersion = asyncHandler(async (req, res) => {
  const version = await AppVersionService.createVersion(req.body);
  return ApiResponse.created(res, version, 'Version created');
});

const getAllVersions = asyncHandler(async (req, res) => {
  const { page, limit, platform } = req.query;
  const result = await AppVersionService.getAllVersions({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    platform,
  });
  return ApiResponse.success(res, result, 'Versions fetched');
});

const updateVersion = asyncHandler(async (req, res) => {
  const version = await AppVersionService.updateVersion(req.params.id, req.body);
  return ApiResponse.success(res, version, 'Version updated');
});

const deleteVersion = asyncHandler(async (req, res) => {
  const version = await AppVersionService.deleteVersion(req.params.id);
  return ApiResponse.success(res, version, 'Version deleted');
});

module.exports = {
  checkVersion,
  getLatest,
  createVersion,
  getAllVersions,
  updateVersion,
  deleteVersion,
};