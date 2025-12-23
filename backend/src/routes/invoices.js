const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { authenticateToken } = require('../middleware/auth');

// Get invoices for logged-in user
router.get('/my-invoices', authenticateToken, invoiceController.getMyInvoices);

// Get all invoices (admin only)
router.get('/all', authenticateToken, invoiceController.getAllInvoices);

module.exports = router;
