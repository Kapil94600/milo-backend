// ============================================
// Audit Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const AuditService = require('../services/audit.service');
const ApiResponse = require('../utils/response');

const getLogs = asyncHandler(async (req, res) => {
  const {
    page, limit, userId, action, resource, resourceId, status, startDate, endDate,
  } = req.query;

  const result = await AuditService.getLogs({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
    userId,
    action,
    resource,
    resourceId,
    status,
    startDate,
    endDate,
  });

  return ApiResponse.success(res, result, 'Audit logs fetched');
});

const getUserLogs = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await AuditService.getUserLogs(req.params.userId, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
  });
  return ApiResponse.success(res, result, 'User logs fetched');
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await AuditService.getStats();
  return ApiResponse.success(res, stats, 'Audit stats');
});

const cleanup = asyncHandler(async (req, res) => {
  const { days = 90 } = req.query;
  const result = await AuditService.cleanup(parseInt(days));
  return ApiResponse.success(res, result, 'Old logs cleaned');
});

module.exports = { getLogs, getUserLogs, getStats, cleanup };