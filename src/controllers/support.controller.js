// ============================================
// Support Controller
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const SupportService = require('../services/support.service');
const ApiResponse = require('../utils/response');

// User
const createTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportService.createTicket(req.user.id, {
    ...req.body,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return ApiResponse.created(res, ticket, 'Ticket created');
});

const getMyTickets = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await SupportService.getMyTickets(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return ApiResponse.success(res, result, 'My tickets fetched');
});

const getTicketById = asyncHandler(async (req, res) => {
  const ticket = await SupportService.getTicketById(req.params.id, req.user.id);
  return ApiResponse.success(res, ticket, 'Ticket fetched');
});

const addMessage = asyncHandler(async (req, res) => {
  const message = await SupportService.addMessage(req.params.id, req.user.id, req.body);
  return ApiResponse.created(res, message, 'Message added');
});

const rateTicket = asyncHandler(async (req, res) => {
  const { rating, feedback } = req.body;
  const ticket = await SupportService.rateTicket(req.params.id, req.user.id, rating, feedback);
  return ApiResponse.success(res, ticket, 'Ticket rated');
});

// Admin
const getTickets = asyncHandler(async (req, res) => {
  const { page, limit, status, category, priority, search } = req.query;
  const result = await SupportService.getTickets({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
    category,
    priority,
    search,
  });
  return ApiResponse.success(res, result, 'Tickets fetched');
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status, resolution } = req.body;
  const ticket = await SupportService.updateTicketStatus(req.params.id, status, req.user.id, resolution);
  return ApiResponse.success(res, ticket, 'Status updated');
});

const assignTicket = asyncHandler(async (req, res) => {
  const { adminId } = req.body;
  const ticket = await SupportService.assignTicket(req.params.id, adminId || req.user.id);
  return ApiResponse.success(res, ticket, 'Ticket assigned');
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await SupportService.getStats();
  return ApiResponse.success(res, stats, 'Stats fetched');
});

const deleteTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportService.deleteTicket(req.params.id);
  return ApiResponse.success(res, ticket, 'Ticket deleted');
});

module.exports = {
  createTicket,
  getMyTickets,
  getTicketById,
  addMessage,
  rateTicket,
  getTickets,
  updateStatus,
  assignTicket,
  getStats,
  deleteTicket,
};