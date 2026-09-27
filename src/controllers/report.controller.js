// ============================================
// Report Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const ReportService = require('../services/report.service');
const ApiResponse = require('../utils/response');

// User
const createReport = asyncHandler(async (req, res) => {
  const report = await ReportService.createReport(req.user.id, {
    ...req.body,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return ApiResponse.created(res, report, 'Report submitted');
});

const getMyReports = asyncHandler(async (req, res) => {
  const reports = await ReportService.getMyReports(req.user.id);
  return ApiResponse.success(res, reports, 'My reports fetched');
});

const getReportById = asyncHandler(async (req, res) => {
  const report = await ReportService.getReportById(req.params.id, req.user.id);
  return ApiResponse.success(res, report, 'Report fetched');
});

// Admin
const getReports = asyncHandler(async (req, res) => {
  const { page, limit, status, type, category, priority } = req.query;
  const result = await ReportService.getReports({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
    type,
    category,
    priority,
  });
  return ApiResponse.success(res, result, 'Reports fetched');
});

const updateReport = asyncHandler(async (req, res) => {
  const report = await ReportService.updateReportStatus(req.params.id, req.user.id, req.body);
  return ApiResponse.success(res, report, 'Report updated');
});

const deleteReport = asyncHandler(async (req, res) => {
  const report = await ReportService.deleteReport(req.params.id);
  return ApiResponse.success(res, report, 'Report deleted');
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await ReportService.getStats();
  return ApiResponse.success(res, stats, 'Report stats fetched');
});

module.exports = {
  createReport,
  getMyReports,
  getReportById,
  getReports,
  updateReport,
  deleteReport,
  getStats,
};