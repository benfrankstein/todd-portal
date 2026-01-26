const express = require('express');
const router = express.Router();
const appSettingsController = require('../controllers/appSettingsController');
const { authenticateToken } = require('../middleware/auth');

// Get all settings (admin only)
router.get('/', authenticateToken, appSettingsController.getAllSettings);

// Get specific setting
router.get('/:key', authenticateToken, appSettingsController.getSetting);

// Update setting (admin only)
router.put('/:key', authenticateToken, appSettingsController.updateSetting);

module.exports = router;
