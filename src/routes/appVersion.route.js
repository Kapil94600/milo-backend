// ============================================
// App Version Routes
// ============================================

const express = require('express');
const AppVersionController = require('../controllers/appVersion.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const AppVersionValidator = require('../validators/appVersion.validator');

const router = express.Router();

// ============================================
// PUBLIC (no auth)
// ============================================
router.post('/check', validate(AppVersionValidator.checkVersion), AppVersionController.checkVersion);
router.get('/latest/:platform', AppVersionController.getLatest);

// ============================================
// ADMIN
// ============================================
router.use(authenticate, requireAdmin);

router.post('/', validate(AppVersionValidator.createVersion), AppVersionController.createVersion);
router.get('/', validate(AppVersionValidator.paginationQuery), AppVersionController.getAllVersions);
router.put('/:id', validate(AppVersionValidator.updateVersion), AppVersionController.updateVersion);
router.delete('/:id', AppVersionController.deleteVersion);

module.exports = router;