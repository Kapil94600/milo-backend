// ============================================
// Favorite Routes
// ============================================

const express = require('express');
const FavoriteController = require('../controllers/favorite.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const FavoriteValidator = require('../validators/favorite.validator');

const router = express.Router();

router.use(authenticate);

// Specific FIRST
router.get('/count', FavoriteController.getCount);
router.get('/check/:favoriteId', FavoriteController.checkFavorite);
router.get('/', validate(FavoriteValidator.paginationQuery), FavoriteController.getMyFavorites);

// Add
router.post('/', validate(FavoriteValidator.addFavorite), FavoriteController.addFavorite);

// Update notes
router.put(
  '/:favoriteId/notes',
  validate(FavoriteValidator.updateNotes),
  FavoriteController.updateNotes
);

// Remove (dynamic LAST)
router.delete('/:favoriteId', FavoriteController.removeFavorite);

module.exports = router;