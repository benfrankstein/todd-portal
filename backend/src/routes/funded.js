const express = require('express');
const router = express.Router();
const fundedController = require('../controllers/fundedController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Client routes - get their own funded records
router.get('/my-records', authenticateToken, fundedController.getMyFundedRecords);

// Admin routes - get all funded records
router.get('/all', authenticateToken, requireAdmin, fundedController.getAllFundedRecords);

module.exports = router;
