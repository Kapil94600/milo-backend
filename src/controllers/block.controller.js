// ============================================
// Block Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const BlockService = require('../services/block.service');
const ApiResponse = require('../utils/response');

// POST /blocks
const blockUser = asyncHandler(async (req, res) => {
  const { blockedId, reason, expiresAt } = req.body;
  const block = await BlockService.blockUser(req.user.id, blockedId, reason, expiresAt);
  return ApiResponse.created(res, block, 'User blocked successfully');
});

// DELETE /blocks/:blockedId
const unblockUser = asyncHandler(async (req, res) => {
  const block = await BlockService.unblockUser(req.user.id, req.params.blockedId);
  return ApiResponse.success(res, block, 'User unblocked');
});

// GET /blocks
const getMyBlocked = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await BlockService.getMyBlockedUsers(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return ApiResponse.success(res, result, 'Blocked users fetched');
});

// GET /blocks/check/:userId
const checkBlocked = asyncHandler(async (req, res) => {
  const isBlocked = await BlockService.isBlockedEitherWay(req.user.id, req.params.userId);
  return ApiResponse.success(res, { isBlocked }, 'Block status checked');
});

// GET /blocks/count
const getCount = asyncHandler(async (req, res) => {
  const count = await BlockService.getBlockCount(req.user.id);
  return ApiResponse.success(res, { count }, 'Count fetched');
});

module.exports = {
  blockUser,
  unblockUser,
  getMyBlocked,
  checkBlocked,
  getCount,
};