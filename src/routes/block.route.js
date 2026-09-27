// ============================================
// Block Routes
// ============================================

const express = require('express');
const BlockController = require('../controllers/block.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const BlockValidator = require('../validators/block.validator');

const router = express.Router();

router.use(authenticate);

// Specific FIRST
router.get('/count', BlockController.getCount);
router.get('/check/:userId', BlockController.checkBlocked);
router.get('/', validate(BlockValidator.paginationQuery), BlockController.getMyBlocked);

// Block
router.post('/', validate(BlockValidator.blockUser), BlockController.blockUser);

// Unblock (dynamic LAST)
router.delete('/:blockedId', BlockController.unblockUser);

module.exports = router;