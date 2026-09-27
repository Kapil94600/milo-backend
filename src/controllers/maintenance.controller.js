// ============================================
// Maintenance Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const MaintenanceService = require('../services/maintenance.service');
const ApiResponse = require('../utils/response');

// ============================================
// GET /maintenance/status — public
// ============================================
const getStatus = asyncHandler(async (req, res) => {
  const status = await MaintenanceService.getStatus();
  return ApiResponse.success(res, status, 'Maintenance status fetched');
});

// ============================================
// POST /maintenance/enable — admin
// ============================================
const enable = asyncHandler(async (req, res) => {
  const { message, type, scheduledStart, scheduledEnd, affectedServices } = req.body;

  const result = await MaintenanceService.enable(message, req.user.id, {
    type,
    scheduledStart,
    scheduledEnd,
    affectedServices,
  });

  return ApiResponse.created(res, result, 'Maintenance mode enabled');
});

// ============================================
// POST /maintenance/disable — admin
// ============================================
const disable = asyncHandler(async (req, res) => {
  const result = await MaintenanceService.disable(req.user.id);
  return ApiResponse.success(res, result, 'Maintenance mode disabled');
});

// ============================================
// PUT /maintenance/message — admin
// ============================================
const updateMessage = asyncHandler(async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return ApiResponse.badRequest(res, 'Message is required');
  }

  const result = await MaintenanceService.updateMessage(message, req.user.id);
  return ApiResponse.success(res, result, 'Maintenance message updated');
});

// ============================================
// GET /maintenance/history — admin
// ============================================
const getHistory = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await MaintenanceService.getHistory({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return ApiResponse.success(res, result, 'Maintenance history fetched');
});

module.exports = {
  getStatus,
  enable,
  disable,
  updateMessage,
  getHistory,
};