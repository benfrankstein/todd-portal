const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Public routes
router.post('/login', authController.login);
router.post('/forgot-password', authController.requestPasswordReset);
router.get('/reset-password/:token', authController.validateResetToken);
router.post('/reset-password', authController.resetPassword);

// Protected routes (require authentication)
router.get('/me', authenticateToken, authController.getCurrentUser);
router.post('/reset-first-time-password', authenticateToken, authController.resetFirstTimePassword);
router.post('/send-verification-code', authenticateToken, authController.sendVerificationCode);
router.post('/verify-phone', authenticateToken, authController.verifyPhone);

// Admin-only routes
router.get('/business-names', authenticateToken, requireAdmin, authController.getBusinessNames);
router.post('/create-client', authenticateToken, requireAdmin, authController.createClientUser);
router.get('/investor-names', authenticateToken, requireAdmin, authController.getInvestorNames);
router.post('/create-investor', authenticateToken, requireAdmin, authController.createInvestorUser);
router.get('/capinvestor-names', authenticateToken, requireAdmin, authController.getCapInvestorNames);
router.post('/create-capinvestor', authenticateToken, requireAdmin, authController.createCapInvestorUser);
router.get('/users', authenticateToken, requireAdmin, authController.getAllUsers);
router.delete('/users/:id', authenticateToken, requireAdmin, authController.deleteUser);
router.patch('/users/:id/business-names', authenticateToken, requireAdmin, authController.updateUserBusinessNames);

module.exports = router;
