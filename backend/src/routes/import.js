const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Test Google Sheets connection (admin only)
router.get('/test', authenticateToken, requireAdmin, importController.testConnection);

// Import from Google Sheet (admin only)
router.post('/google-sheet', authenticateToken, requireAdmin, importController.importFromGoogleSheet);

// Sync all sheets (Funded, Promissory, Cap Investor) - admin only
router.post('/sync-all', authenticateToken, requireAdmin, importController.syncAllSheets);

module.exports = router;
