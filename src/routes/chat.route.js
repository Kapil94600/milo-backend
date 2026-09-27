// ============================================
// Chat Routes
// ============================================

const express = require('express');
const ChatController = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ChatValidator = require('../validators/chat.validator');

const router = express.Router();

// All chat routes require authentication
router.use(authenticate);

// ============================================
// SPECIFIC routes FIRST
// ============================================

// ✅ NEW: Chat costs (public to authenticated users)
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
router.put('/messages/:messageId', validate(ChatValidator.editMessage), ChatController.editMessage);
router.delete('/messages/:messageId/me', ChatController.deleteMessageForMe);
router.delete('/messages/:messageId/all', ChatController.deleteMessageForAll);
router.post('/messages/:messageId/reactions', validate(ChatValidator.addReaction), ChatController.addReaction);
router.delete('/messages/:messageId/reactions', ChatController.removeReaction);

// Create chat
router.post('/direct', validate(ChatValidator.createDirectChat), ChatController.createDirectChat);
router.post('/group', validate(ChatValidator.createGroupChat), ChatController.createGroupChat);

// Chats list
router.get('/', validate(ChatValidator.paginationQuery), ChatController.getChats);

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

module.exports = router;