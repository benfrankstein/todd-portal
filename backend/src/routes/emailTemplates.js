const express = require('express');
const router = express.Router();
const emailTemplateController = require('../controllers/emailTemplateController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// Get all templates
router.get('/', emailTemplateController.getAllTemplates);

// Get specific template by name
router.get('/:name', emailTemplateController.getTemplateByName);

// Update template
router.put('/:name', emailTemplateController.updateTemplate);

// Preview template with sample data
router.get('/:name/preview', emailTemplateController.previewTemplate);

// Send test email
router.post('/:name/test', emailTemplateController.sendTestEmail);

// Reset template to default
router.post('/:name/reset', emailTemplateController.resetTemplate);

module.exports = router;
