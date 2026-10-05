// ============================================
// Call Controller (Bond) — Complete
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const CallService = require('../services/call.service');
const ApiResponse = require('../utils/response');

// POST /calls/initiate
const initiateCall = asyncHandler(async (req, res) => {
  const { receiverId, type = 'VOICE', quality = 'MEDIUM' } = req.body;
  const call = await CallService.initiateCall(req.user.id, receiverId, type, quality);
  return ApiResponse.created(res, call, 'Call initiated');
});

// PUT /calls/:callId/accept
const acceptCall = asyncHandler(async (req, res) => {
  const call = await CallService.acceptCall(req.params.callId, req.user.id);
  return ApiResponse.success(res, call, 'Call accepted');
});

// PUT /calls/:callId/reject
const rejectCall = asyncHandler(async (req, res) => {
  const call = await CallService.rejectCall(req.params.callId, req.user.id);
  return ApiResponse.success(res, call, 'Call rejected');
});

// PUT /calls/:callId/cancel
const cancelCall = asyncHandler(async (req, res) => {
  const call = await CallService.cancelCall(req.params.callId, req.user.id);
  return ApiResponse.success(res, call, 'Call cancelled');
});

// PUT /calls/:callId/end
const endCall = asyncHandler(async (req, res) => {
  const call = await CallService.endCall(req.params.callId, req.user.id);
  return ApiResponse.success(res, call, 'Call ended');
});

// GET /calls/history
const getCallHistory = asyncHandler(async (req, res) => {
  const { page, limit, type, status } = req.query;
  const result = await CallService.getCallHistory(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    type: type || undefined,
    status: status || undefined,
  });
  return ApiResponse.success(res, result, 'Call history fetched');
});

// GET /calls/active
const getActiveCall = asyncHandler(async (req, res) => {
  const call = await CallService.getActiveCall(req.user.id);
  return ApiResponse.success(res, call, 'Active call fetched');
});

// GET /calls/missed
const getMissedCalls = asyncHandler(async (req, res) => {
  const calls = await CallService.getMissedCalls(req.user.id);
  return ApiResponse.success(res, calls, 'Missed calls fetched');
});

// GET /calls/stats
const getCallStats = asyncHandler(async (req, res) => {
  const stats = await CallService.getCallStats(req.user.id);
  return ApiResponse.success(res, stats, 'Call stats fetched');
});

// GET /calls/rates
const getCallRates = asyncHandler(async (req, res) => {
  const rates = await CallService.getCallRates();
  return ApiResponse.success(res, rates, 'Call rates fetched');
});

// GET /calls/video-eligibility
const getVideoEligibility = asyncHandler(async (req, res) => {
  const eligibility = await CallService.checkVideoEligibility(req.user.id);
  return ApiResponse.success(res, eligibility, 'Video eligibility checked');
});

// GET /calls/:callId
const getCallById = asyncHandler(async (req, res) => {
  const call = await CallService.getCallById(req.params.callId, req.user.id);
  return ApiResponse.success(res, call, 'Call fetched');
});

// POST /calls/:callId/recording
const saveRecording = asyncHandler(async (req, res) => {
  const call = await CallService.saveRecording(req.params.callId, req.user.id, req.body);
  return ApiResponse.success(res, call, 'Recording saved');
});

// PUT /calls/admin/rates
const updateCallRates = asyncHandler(async (req, res) => {
  const { voiceRate, videoRate, minCoinsForVideo, platformCommission } = req.body;
  const rates = await CallService.updateCallRates({
    voiceRate,
    videoRate,
    minCoinsForVideo,
    platformCommission,
  });
  return ApiResponse.success(res, rates, 'Call rates updated');
});

// ⭐ NEW: GET /calls/admin/all
const getAllCalls = asyncHandler(async (req, res) => {
  const { page, limit, type, status, userId } = req.query;
  const result = await CallService.getAllCalls({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    type: type || undefined,
    status: status || undefined,
    userId: userId || undefined,
  });
  return ApiResponse.success(res, result, 'All calls fetched');
});

// ============================================
// Exports
// ============================================
module.exports = {
  initiateCall,
  acceptCall,
  rejectCall,
  cancelCall,
  endCall,
  getCallHistory,
  getActiveCall,
  getMissedCalls,
  getCallStats,
  getCallRates,
  getVideoEligibility,
  getCallById,
  saveRecording,
  updateCallRates,
  getAllCalls, // ⭐ NEW
};