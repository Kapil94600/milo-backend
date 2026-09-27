// ============================================
// Girl Controller — Complete
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const GirlService = require('../services/girl.service');
const ApiResponse = require('../utils/response');

// ============================================
// SELF — Submit Girl Registration Request
// ============================================
const submitGirlRequest = asyncHandler(async (req, res) => {
  const request = await GirlService.submitGirlRequest(req.user.id, req.body);
  return ApiResponse.created(
    res,
    request,
    'Request submitted! Admin will review it soon.'
  );
});

// ============================================
// SELF — Get My Request Status
// ============================================
const getMyGirlRequest = asyncHandler(async (req, res) => {
  const request = await GirlService.getMyGirlRequest(req.user.id);
  return ApiResponse.success(res, request, 'Request fetched');
});

// ============================================
// SELF — Create My Profile (Legacy)
// ============================================
const createMyProfile = asyncHandler(async (req, res) => {
  const girl = await GirlService.createMyProfile(req.user.id, req.body);
  return ApiResponse.created(res, girl, 'Girl profile created successfully');
});

// ============================================
// SELF — Get My Profile
// ============================================
const getMyProfile = asyncHandler(async (req, res) => {
  const girl = await GirlService.getMyProfile(req.user.id);
  return ApiResponse.success(res, girl, 'My profile fetched');
});

// ============================================
// SELF — Update My Profile
// ============================================
const updateMyProfile = asyncHandler(async (req, res) => {
  const girl = await GirlService.updateMyProfile(req.user.id, req.body);
  return ApiResponse.success(res, girl, 'Profile updated');
});

// ============================================
// SELF — Update Online Status
// ============================================
const updateOnlineStatus = asyncHandler(async (req, res) => {
  const { isOnline } = req.body;
  const girl = await GirlService.updateOnlineStatus(req.user.id, isOnline);
  return ApiResponse.success(res, girl, 'Online status updated');
});

// ============================================
// SELF — Update Availability
// ============================================
const updateAvailability = asyncHandler(async (req, res) => {
  const { isAvailable } = req.body;
  const girl = await GirlService.updateAvailability(req.user.id, isAvailable);
  return ApiResponse.success(res, girl, 'Availability updated');
});

// ============================================
// SELF — Upload Verification Docs
// ============================================
// ============================================
// SELF — Upload Verification Docs (with file upload)
// ============================================
const uploadVerificationDocuments = asyncHandler(async (req, res) => {
  const data = { ...req.body };

  // Attach uploaded files (if multipart)
  if (req.files) {
    if (req.files.idProofFile?.[0]) data.idProofFile = req.files.idProofFile[0];
    if (req.files.selfieFile?.[0]) data.selfieFile = req.files.selfieFile[0];
  }

  const girl = await GirlService.uploadVerificationDocs(req.user.id, data);
  return ApiResponse.success(res, girl, 'Documents uploaded');
});

// ============================================
// SELF — Get Earnings
// ============================================
const getEarnings = asyncHandler(async (req, res) => {
  const girl = await GirlService.getMyProfile(req.user.id);
  return ApiResponse.success(
    res,
    {
      total: girl.earningsTotal,
      today: girl.earningsToday,
      thisWeek: girl.earningsThisWeek,
      thisMonth: girl.earningsThisMonth,
      coinsEarned: girl.totalCoinsEarned,
    },
    'Earnings fetched'
  );
});

// ============================================
// SELF — Delete My Profile
// ============================================
const deleteMyProfile = asyncHandler(async (req, res) => {
  const result = await GirlService.deleteMyProfile(req.user.id);
  return ApiResponse.success(res, result, 'Profile deleted');
});

// ============================================
// ADMIN — Get All Girl Requests
// ============================================
const getAllGirlRequests = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const result = await GirlService.getAllGirlRequests({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
  });
  return ApiResponse.success(res, result, 'Requests fetched');
});

// ============================================
// ADMIN — Approve / Reject Request
// ============================================
const processGirlRequest = asyncHandler(async (req, res) => {
  const { action, rejectionReason } = req.body;
  const result = await GirlService.processGirlRequest(
    req.params.id,
    action,
    req.user.id,
    rejectionReason
  );
  return ApiResponse.success(
    res,
    result,
    `Request ${action.toLowerCase()} successfully`
  );
});

// ============================================
// ADMIN — Create Girl Directly
// ============================================
const createGirlProfile = asyncHandler(async (req, res) => {
  const girl = await GirlService.createGirlProfile(req.body);
  return ApiResponse.created(res, girl, 'Girl profile created');
});

// ============================================
// ADMIN — Get All Girls
// ============================================
const getAllGirls = asyncHandler(async (req, res) => {
  const { page, limit, search, isVerified, status } = req.query;
  const result = await GirlService.getAllGirls({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    search: search || '',
    isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
    status: status || undefined,
  });
  return ApiResponse.success(res, result, 'Girls fetched');
});

// ============================================
// ADMIN — Verify Girl
// ============================================
const verifyGirl = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const girl = await GirlService.verifyGirl(req.params.id, status);
  return ApiResponse.success(
    res,
    girl,
    `Girl ${status.toLowerCase()} successfully`
  );
});

// ============================================
// ADMIN — Update Girl
// ============================================
const updateGirl = asyncHandler(async (req, res) => {
  const girl = await GirlService.updateGirlById(req.params.id, req.body);
  return ApiResponse.success(res, girl, 'Girl updated');
});

// ============================================
// ADMIN — Delete Girl
// ============================================
const deleteGirl = asyncHandler(async (req, res) => {
  const result = await GirlService.deleteGirl(req.params.id);
  return ApiResponse.success(res, result, 'Girl deleted');
});

// ============================================
// PUBLIC — Get Available Girls
// ============================================
const getAvailableGirls = asyncHandler(async (req, res) => {
  const { page, limit, category, language, search, minRating } = req.query;
  const result = await GirlService.getAvailableGirls({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    category,
    language,
    search,
    minRating,
  });
  return ApiResponse.success(res, result, 'Available girls fetched');
});

// ============================================
// PUBLIC — Top Girls
// ============================================
const getTopGirls = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const girls = await GirlService.getTopGirls(parseInt(limit) || 10);
  return ApiResponse.success(res, girls, 'Top girls fetched');
});

// ============================================
// PUBLIC — Get Girl By ID
// ============================================
const getGirlProfileById = asyncHandler(async (req, res) => {
  const girl = await GirlService.getGirlById(req.params.id);
  return ApiResponse.success(res, girl, 'Girl fetched');
});

// ============================================
// PUBLIC — Get Girl By User ID
// ============================================
const getGirlByUserId = asyncHandler(async (req, res) => {
  const girl = await GirlService.getGirlByUserId(req.params.userId);
  return ApiResponse.success(res, girl, 'Girl fetched');
});

// ============================================
// Exports
// ============================================
module.exports = {
  // Self
  submitGirlRequest,
  getMyGirlRequest,
  createMyProfile,
  getMyProfile,
  updateMyProfile,
  updateOnlineStatus,
  updateAvailability,
  uploadVerificationDocuments,
  getEarnings,
  deleteMyProfile,

  // Admin — Requests
  getAllGirlRequests,
  processGirlRequest,

  // Admin — Girls
  createGirlProfile,
  getAllGirls,
  verifyGirl,
  updateGirl,
  deleteGirl,

  // Public
  getAvailableGirls,
  getTopGirls,
  getGirlProfileById,
  getGirlByUserId,
};