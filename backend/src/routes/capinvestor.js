const express = require('express');
const router = express.Router();
const capInvestorController = require('../controllers/capInvestorController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Protected routes (require authentication)
router.get('/my-records', authenticateToken, capInvestorController.getMyRecords);

// Admin-only routes
router.get('/all', authenticateToken, requireAdmin, capInvestorController.getAllRecords);

module.exports = router;
