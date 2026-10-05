// ============================================
// Girl Controller — Complete with Rate Management
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
// ⭐ SELF — Update My Profile (with rates)
// ============================================
const updateMyProfile = asyncHandler(async (req, res) => {
  const girl = await GirlService.updateMyProfile(req.user.id, req.body);

  // Check if rates were changed
  const hasRateChange =
    req.body.hourlyRate !== undefined ||
    req.body.videoCallRate !== undefined ||
    req.body.chatMessageRate !== undefined;

  const message = hasRateChange
    ? 'Profile updated. Rate changes pending admin approval.'
    : 'Profile updated';

  return ApiResponse.success(res, girl, message);
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
const uploadVerificationDocuments = asyncHandler(async (req, res) => {
  const data = { ...req.body };

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
// ⭐ SELF — Get My Rates
// ============================================
const getMyRates = asyncHandler(async (req, res) => {
  const girl = await GirlService.getMyProfile(req.user.id);

  return ApiResponse.success(
    res,
    {
      currentRates: {
        hourlyRate: girl.hourlyRate,
        videoCallRate: girl.videoCallRate,
        chatMessageRate: girl.chatMessageRate,
      },
      pendingRates: {
        hourlyRate: girl.pendingHourlyRate,
        videoCallRate: girl.pendingVideoRate,
        chatMessageRate: girl.pendingChatRate,
      },
      rateApproved: girl.rateApproved,
      hasPendingChanges: !girl.rateApproved,
    },
    'Rates fetched'
  );
});

// ============================================
// SELF — Update My Rates
// ============================================
const updateMyRates = asyncHandler(async (req, res) => {
  const { hourlyRate, videoCallRate, chatMessageRate } = req.body;

  if (
    hourlyRate === undefined &&
    videoCallRate === undefined &&
    chatMessageRate === undefined
  ) {
    return ApiResponse.badRequest(res, 'Please provide at least one rate');
  }

  const girl = await GirlService.updateMyProfile(req.user.id, {
    hourlyRate,
    videoCallRate,
    chatMessageRate,
  });

  return ApiResponse.success(
    res,
    {
      pendingRates: {
        hourlyRate: girl.pendingHourlyRate,
        videoCallRate: girl.pendingVideoRate,
        chatMessageRate: girl.pendingChatRate,
      },
      rateApproved: girl.rateApproved,
    },
    'Rate change request submitted for admin approval'
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
  const { page, limit, search, isVerified, status, rateApproved } = req.query;
  const result = await GirlService.getAllGirls({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    search: search || '',
    isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
    status: status || undefined,
    rateApproved:
      rateApproved !== undefined ? rateApproved === 'true' : undefined,
  });
  return ApiResponse.success(res, result, 'Girls fetched');
});

// ============================================
// ⭐ ADMIN — Get Pending Rate Changes
// ============================================
const getPendingRateChanges = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await GirlService.getPendingRateChanges({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return ApiResponse.success(res, result, 'Pending rate changes fetched');
});

// ============================================
// ⭐ ADMIN — Approve/Reject Rate Change
// ============================================
const processRateChange = asyncHandler(async (req, res) => {
  const { action } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(action)) {
    return ApiResponse.badRequest(res, 'Action must be APPROVED or REJECTED');
  }

  const girl = await GirlService.approveRateChange(req.params.id, action);
  return ApiResponse.success(
    res,
    girl,
    `Rate change ${action.toLowerCase()}`
  );
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
// ⭐ GIRL REQUEST — Pre-check (NEW)
// ============================================
const canRequestGirl = asyncHandler(async (req, res) => {
  const GirlRequestService = require('../services/girlRequest.service');
  const result = await GirlRequestService.canRequest(req.user.id);
  return ApiResponse.success(res, result, 'Can-request checked');
});

// ============================================
// ⭐ GIRL REQUEST — Cancel (NEW)
// ============================================
const cancelGirlRequest = asyncHandler(async (req, res) => {
  const GirlRequestService = require('../services/girlRequest.service');
  const result = await GirlRequestService.cancelRequest(req.user.id);
  return ApiResponse.success(res, result, 'Request cancelled');
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
  const {
    page,
    limit,
    category,
    language,
    search,
    minRating,
    maxRating,
    minRate,
    maxRate,
    sortBy,
    onlineOnly,
  } = req.query;

  const result = await GirlService.getAvailableGirls({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    category,
    language,
    search,
    minRating,
    maxRating,
    minRate,
    maxRate,
    sortBy,
    onlineOnly,
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
  getMyRates,        // ⭐ NEW
  updateMyRates,     // ⭐ NEW
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
  getPendingRateChanges,  // ⭐ NEW
  processRateChange,      // ⭐ NEW

  // Public
  getAvailableGirls,
  getTopGirls,
  getGirlProfileById,
  getGirlByUserId,
  canRequestGirl,
  cancelGirlRequest,
};