// ============================================
// Chat Routes (Bond) — Complete
// ============================================

const express = require('express');
const ChatController = require('../controllers/chat.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ChatValidator = require('../validators/chat.validator');

const router = express.Router();

// All chat routes require authentication
router.use(authenticate);

// ============================================
// SPECIFIC routes FIRST
// ============================================

// Chat costs
router.get('/costs', ChatController.getChatCosts);

// Unread count (before /:id)
router.get('/unread/total', ChatController.getTotalUnread);

// Search (before /:id)
router.get(
  '/search',
  validate(ChatValidator.searchMessages),
  ChatController.searchMessages
);

// Message actions (specific paths)
router.put(
  '/messages/:messageId',
  validate(ChatValidator.editMessage),
  ChatController.editMessage
);
router.delete('/messages/:messageId/me', ChatController.deleteMessageForMe);
router.delete('/messages/:messageId/all', ChatController.deleteMessageForAll);
router.post(
  '/messages/:messageId/reactions',
  validate(ChatValidator.addReaction),
  ChatController.addReaction
);
router.delete('/messages/:messageId/reactions', ChatController.removeReaction);

// ⭐ ADMIN — Chat monitoring (before /:id)
router.get(
  '/admin/all',
  requireAdmin,
  ChatController.getAllChatsAdmin
);

router.get(
  '/admin/:chatId/messages',
  requireAdmin,
  ChatController.getChatMessagesAdmin
);

// Create chat
router.post(
  '/direct',
  validate(ChatValidator.createDirectChat),
  ChatController.createDirectChat
);
router.post(
  '/group',
  validate(ChatValidator.createGroupChat),
  ChatController.createGroupChat
);

// Chats list
router.get(
  '/',
  validate(ChatValidator.paginationQuery),
  ChatController.getChats
);

// ============================================
// Dynamic routes LAST
// ============================================

// Specific chat actions
router.get('/:id', ChatController.getChat);
router.delete('/:chatId', ChatController.deleteChat);

// Messages in chat
router.post(
  '/:chatId/messages',
  validate(ChatValidator.sendMessage),
  ChatController.sendMessage
);
router.get(
  '/:chatId/messages',
  validate(ChatValidator.paginationQuery),
  ChatController.getMessages
);
router.put('/:chatId/read', ChatController.markAsRead);

// Group management
router.put(
  '/:chatId/participants',
  validate(ChatValidator.addParticipants),
  ChatController.addParticipants
);
router.delete('/:chatId/participants/:userId', ChatController.removeParticipant);
router.post('/:chatId/leave', ChatController.leaveGroup);
// ============================================
// ⭐ NEW: Starred messages
// ============================================
router.get('/starred', ChatController.getStarredMessages);

// ============================================
// ⭐ NEW: Message actions
// ============================================
router.post(
  '/messages/:messageId/forward',
  ChatController.forwardMessage
);
router.post(
  '/messages/:messageId/star',
  ChatController.toggleStarMessage
);

// ============================================
// ⭐ NEW: Export chat
// ============================================
router.get('/:chatId/export', ChatController.exportChat);

module.exports = router;