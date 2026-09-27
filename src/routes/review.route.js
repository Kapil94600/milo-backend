// ============================================
// Review Routes
// ============================================

const express = require('express');
const ReviewController = require('../controllers/review.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ReviewValidator = require('../validators/review.validator');

const router = express.Router();

router.use(authenticate);

// Specific FIRST
router.get('/my-reviews', validate(ReviewValidator.paginationQuery), ReviewController.getMyGivenReviews);
router.get('/check/:callId', ReviewController.checkCallReview);

// Create
router.post('/', validate(ReviewValidator.createReview), ReviewController.createReview);

// Get reviews for user
router.get('/user/:userId', validate(ReviewValidator.paginationQuery), ReviewController.getUserReviews);

// Admin
router.put('/:id/hide', requireAdmin, ReviewController.hideReview);

// Dynamic LAST
router.put('/:id', validate(ReviewValidator.updateReview), ReviewController.updateReview);
router.delete('/:id', ReviewController.deleteReview);

module.exports = router;