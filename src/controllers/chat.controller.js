// ============================================
// Chat Controller (Bond) — Complete
// ============================================

const asyncHandler = require('../utils/asyncHandler');
const ChatService = require('../services/chat.service');
const ApiResponse = require('../utils/response');

// ============================================
// USER — Create chat
// ============================================

// POST /chats/direct
const createDirectChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const chat = await ChatService.createDirectChat(req.user.id, userId);
  return ApiResponse.created(res, chat, 'Direct chat ready');
});

// POST /chats/group
const createGroupChat = asyncHandler(async (req, res) => {
  const { name, participants } = req.body;
  const chat = await ChatService.createGroupChat(req.user.id, name, participants);
  return ApiResponse.created(res, chat, 'Group chat created');
});

// ============================================
// USER — Get chats
// ============================================

// GET /chats
const getChats = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await ChatService.getUserChats(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return ApiResponse.success(res, result, 'Chats fetched');
});

// GET /chats/:id
const getChat = asyncHandler(async (req, res) => {
  const chat = await ChatService.getChatById(req.params.id, req.user.id);
  return ApiResponse.success(res, chat, 'Chat fetched');
});

// ============================================
// USER — Messages
// ============================================

// POST /chats/:chatId/messages
const sendMessage = asyncHandler(async (req, res) => {
  const { content, type, mediaUrl, replyToId } = req.body;
  const message = await ChatService.sendMessage(req.params.chatId, req.user.id, {
    content,
    type,
    mediaUrl,
    replyToId,
  });
  return ApiResponse.created(res, message, 'Message sent');
});

// GET /chats/:chatId/messages
const getMessages = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await ChatService.getMessages(req.params.chatId, req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
  });
  return ApiResponse.success(res, result, 'Messages fetched');
});

// PUT /chats/:chatId/read
const markAsRead = asyncHandler(async (req, res) => {
  const result = await ChatService.markAsRead(req.params.chatId, req.user.id);
  return ApiResponse.success(res, result, 'Marked as read');
});

// PUT /chats/messages/:messageId
const editMessage = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const message = await ChatService.editMessage(req.params.messageId, req.user.id, content);
  return ApiResponse.success(res, message, 'Message edited');
});

// DELETE /chats/messages/:messageId/me
const deleteMessageForMe = asyncHandler(async (req, res) => {
  const result = await ChatService.deleteMessageForMe(req.params.messageId, req.user.id);
  return ApiResponse.success(res, result, 'Message deleted for you');
});

// DELETE /chats/messages/:messageId/all
const deleteMessageForAll = asyncHandler(async (req, res) => {
  const result = await ChatService.deleteMessageForAll(req.params.messageId, req.user.id);
  return ApiResponse.success(res, result, 'Message deleted for everyone');
});

// ============================================
// USER — Reactions
// ============================================

// POST /chats/messages/:messageId/reactions
const addReaction = asyncHandler(async (req, res) => {
  const { reaction } = req.body;
  const result = await ChatService.addReaction(req.params.messageId, req.user.id, reaction);
  return ApiResponse.success(res, result, 'Reaction added');
});

// DELETE /chats/messages/:messageId/reactions
const removeReaction = asyncHandler(async (req, res) => {
  const result = await ChatService.removeReaction(req.params.messageId, req.user.id);
  return ApiResponse.success(res, result, 'Reaction removed');
});

// ============================================
// USER — Group management
// ============================================

// PUT /chats/:chatId/participants
const addParticipants = asyncHandler(async (req, res) => {
  const { participants } = req.body;
  const chat = await ChatService.addParticipants(req.params.chatId, req.user.id, participants);
  return ApiResponse.success(res, chat, 'Participants added');
});

// DELETE /chats/:chatId/participants/:userId
const removeParticipant = asyncHandler(async (req, res) => {
  const result = await ChatService.removeParticipant(
    req.params.chatId,
    req.user.id,
    req.params.userId
  );
  return ApiResponse.success(res, result, 'Participant removed');
});

// POST /chats/:chatId/leave
const leaveGroup = asyncHandler(async (req, res) => {
  const result = await ChatService.leaveGroup(req.params.chatId, req.user.id);
  return ApiResponse.success(res, result, 'Left group');
});

// ============================================
// USER — Utility
// ============================================

// GET /chats/unread/total
const getTotalUnread = asyncHandler(async (req, res) => {
  const count = await ChatService.getTotalUnreadCount(req.user.id);
  return ApiResponse.success(res, { unread: count }, 'Unread count fetched');
});

// GET /chats/search
const searchMessages = asyncHandler(async (req, res) => {
  const { q, chatId } = req.query;
  const messages = await ChatService.searchMessages(req.user.id, q, chatId);
  return ApiResponse.success(res, messages, 'Messages searched');
});

// DELETE /chats/:chatId
const deleteChat = asyncHandler(async (req, res) => {
  const result = await ChatService.deleteChat(req.params.chatId, req.user.id);
  return ApiResponse.success(res, result, 'Chat deleted');
});

// GET /chats/costs
const getChatCosts = asyncHandler(async (req, res) => {
  const costs = await ChatService.getChatCosts();
  return ApiResponse.success(res, costs, 'Chat costs fetched');
});

// ============================================
// ⭐ ADMIN — Chat monitoring (NEW)
// ============================================

// GET /chats/admin/all
const getAllChatsAdmin = asyncHandler(async (req, res) => {
  const { page, limit, type, search, userId } = req.query;
  const result = await ChatService.getAllChats({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    type: type || undefined,
    search: search || undefined,
    userId: userId || undefined,
  });
  return ApiResponse.success(res, result, 'All chats fetched');
});

// GET /chats/admin/:chatId/messages
const getChatMessagesAdmin = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await ChatService.getChatMessagesAdmin(req.params.chatId, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
  });
  return ApiResponse.success(res, result, 'Chat messages fetched');
});
// ============================================
// ⭐ FORWARD MESSAGE (NEW)
// ============================================
const forwardMessage = asyncHandler(async (req, res) => {
  const { targetChatIds } = req.body;
  const result = await ChatService.forwardMessage(
    req.params.messageId,
    req.user.id,
    targetChatIds
  );
  return ApiResponse.success(res, result, 'Message forwarded');
});

// ============================================
// ⭐ STAR MESSAGE (NEW)
// ============================================
const toggleStarMessage = asyncHandler(async (req, res) => {
  const result = await ChatService.toggleStarMessage(
    req.params.messageId,
    req.user.id
  );
  return ApiResponse.success(
    res,
    result,
    result.isStarred ? 'Message starred' : 'Message unstarred'
  );
});

const getStarredMessages = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await ChatService.getStarredMessages(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  return ApiResponse.success(res, result, 'Starred messages fetched');
});

// ============================================
// ⭐ EXPORT CHAT (NEW)
// ============================================
const exportChat = asyncHandler(async (req, res) => {
  const result = await ChatService.exportChat(req.params.chatId, req.user.id);
  return ApiResponse.success(res, result, 'Chat exported');
});

// ============================================
// Exports
// ============================================
module.exports = {
  // User
  createDirectChat,
  createGroupChat,
  getChats,
  getChat,
  sendMessage,
  getMessages,
  markAsRead,
  editMessage,
  deleteMessageForMe,
  deleteMessageForAll,
  addReaction,
  removeReaction,
  addParticipants,
  removeParticipant,
  leaveGroup,
  getTotalUnread,
  searchMessages,
  deleteChat,
  getChatCosts,
  // ⭐ Admin
  getAllChatsAdmin,
  getChatMessagesAdmin,
   forwardMessage,
  toggleStarMessage,
  getStarredMessages,
  exportChat,
};