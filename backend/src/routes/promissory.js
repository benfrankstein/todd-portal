const express = require('express');
const router = express.Router();
const promissoryController = require('../controllers/promissoryController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Protected routes (require authentication)
router.get('/my-records', authenticateToken, promissoryController.getMyRecords);

// Admin-only routes
router.get('/all', authenticateToken, requireAdmin, promissoryController.getAllRecords);

module.exports = router;
