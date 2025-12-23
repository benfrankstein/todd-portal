const db = require('../models');
const { sendInvoiceEmail, sendWelcomeEmail } = require('../services/emailService');

/**
 * Get all email templates
 */
exports.getAllTemplates = async (req, res) => {
  try {
    const templates = await db.EmailTemplate.findAll({
      where: { isActive: true },
      order: [['templateName', 'ASC']]
    });

    res.json({
      success: true,
      templates: templates
    });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch email templates'
    });
  }
};

/**
 * Get a specific email template by name
 */
exports.getTemplateByName = async (req, res) => {
  try {
    const { name } = req.params;

    const template = await db.EmailTemplate.findOne({
      where: { templateName: name, isActive: true }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      template: template
    });
  } catch (error) {
    console.error('Error fetching email template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch email template'
    });
  }
};

/**
 * Update an email template
 */
exports.updateTemplate = async (req, res) => {
  try {
    const { name } = req.params;
    const { subject, greeting, bodyMessage, closingMessage, signature } = req.body;

    // Validate required fields
    if (!subject || !greeting || !bodyMessage || !closingMessage || !signature) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Find template
    const template = await db.EmailTemplate.findOne({
      where: { templateName: name }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Update template
    await template.update({
      subject,
      greeting,
      bodyMessage,
      closingMessage,
      signature
    });

    res.json({
      success: true,
      message: 'Template updated successfully',
      template: template
    });
  } catch (error) {
    console.error('Error updating email template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update email template'
    });
  }
};

/**
 * Preview template with sample data
 */
exports.previewTemplate = async (req, res) => {
  try {
    const { name } = req.params;

    const template = await db.EmailTemplate.findOne({
      where: { templateName: name, isActive: true }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Sample data for preview - different for welcome vs invoice templates
    let sampleData;
    let replaceVariables;

    if (name === 'user_welcome') {
      // Welcome email sample data
      sampleData = {
        firstName: 'John',
        email: 'john.doe@example.com',
        password: 'SamplePass123',
        portalUrl: 'https://cplportal.com'
      };

      // Replace variables for welcome template
      replaceVariables = (text, data) => {
        return text
          .replace(/\{\{firstName\}\}/g, data.firstName)
          .replace(/\{\{email\}\}/g, data.email)
          .replace(/\{\{password\}\}/g, data.password)
          .replace(/\{\{portalUrl\}\}/g, data.portalUrl);
      };
    } else {
      // Invoice email sample data
      sampleData = {
        businessName: 'Sample Business LLC',
        month: 'December',
        year: '2025',
        formattedDate: 'December 19, 2025',
        totalAmount: '$5,250.00',
        amountLabel: name === 'invoice_client' ? 'Total Interest Due' : 'Total Interest Earned'
      };

      // Replace variables for invoice template
      replaceVariables = (text, data) => {
        return text
          .replace(/\{\{businessName\}\}/g, data.businessName)
          .replace(/\{\{month\}\}/g, data.month)
          .replace(/\{\{year\}\}/g, data.year)
          .replace(/\{\{formattedDate\}\}/g, data.formattedDate)
          .replace(/\{\{totalAmount\}\}/g, data.totalAmount)
          .replace(/\{\{amountLabel\}\}/g, data.amountLabel);
      };
    }

    const preview = {
      subject: replaceVariables(template.subject, sampleData),
      greeting: replaceVariables(template.greeting, sampleData),
      bodyMessage: replaceVariables(template.bodyMessage, sampleData),
      closingMessage: replaceVariables(template.closingMessage, sampleData),
      signature: replaceVariables(template.signature, sampleData)
    };

    res.json({
      success: true,
      preview: preview,
      sampleData: sampleData
    });
  } catch (error) {
    console.error('Error previewing email template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview email template'
    });
  }
};

/**
 * Send test email using template
 */
exports.sendTestEmail = async (req, res) => {
  try {
    const { name } = req.params;
    const { recipientEmail } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        error: 'Recipient email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address'
      });
    }

    let result;

    // Handle welcome email template differently
    if (name === 'user_welcome') {
      // Send test welcome email with sample data
      result = await sendWelcomeEmail(
        recipientEmail,
        'John',
        'SamplePass123'
      );
    } else {
      // Handle invoice templates
      // Determine role from template name
      let role = 'client';
      if (name === 'invoice_investor') {
        role = 'investor';
      } else if (name === 'invoice_capinvestor') {
        role = 'capinvestor';
      }

      // Create a sample PDF buffer (empty PDF for test)
      const samplePDFBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 100 700 Td (Sample Invoice PDF) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000317 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n409\n%%EOF');

      const fileName = `Test_Invoice_${Date.now()}.pdf`;
      const invoiceDate = new Date();
      const totalAmount = 5250.00;

      // Send test invoice email
      result = await sendInvoiceEmail(
        recipientEmail,
        'Sample Business LLC',
        role,
        samplePDFBuffer,
        fileName,
        invoiceDate,
        totalAmount
      );
    }

    if (result.success) {
      res.json({
        success: true,
        message: `Test email sent successfully to ${recipientEmail}`
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to send test email'
      });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email'
    });
  }
};

/**
 * Reset template to default
 */
exports.resetTemplate = async (req, res) => {
  try {
    const { name } = req.params;

    // Default templates
    const defaults = {
      'invoice_client': {
        subject: 'Monthly Loan Invoice - {{month}} {{year}}',
        greeting: 'Dear Valued Client',
        bodyMessage: 'Please find attached your monthly loan invoice statement.',
        closingMessage: 'Your detailed invoice is attached as a PDF document. If you have any questions or concerns, please don\'t hesitate to contact us.\n\nThank you for your continued partnership.',
        signature: 'Coastal Private Lending Team'
      },
      'invoice_investor': {
        subject: 'Monthly Investment Statement - {{month}} {{year}}',
        greeting: 'Dear Valued Investor',
        bodyMessage: 'Please find attached your monthly investment earnings statement.',
        closingMessage: 'Your detailed invoice is attached as a PDF document. If you have any questions or concerns, please don\'t hesitate to contact us.\n\nThank you for your continued partnership.',
        signature: 'Coastal Private Lending Team'
      },
      'invoice_capinvestor': {
        subject: 'Monthly Investment Statement - {{month}} {{year}}',
        greeting: 'Dear Valued Investor',
        bodyMessage: 'Please find attached your monthly capital investment earnings statement.',
        closingMessage: 'Your detailed invoice is attached as a PDF document. If you have any questions or concerns, please don\'t hesitate to contact us.\n\nThank you for your continued partnership.',
        signature: 'Coastal Private Lending Team'
      },
      'user_welcome': {
        subject: 'Welcome to Coastal Private Lending Portal',
        greeting: 'Hello {{firstName}}',
        bodyMessage: 'Welcome to the Coastal Private Lending Portal! Your account has been created.\n\nYour login credentials:\nEmail: {{email}}\nTemporary Password: {{password}}\n\nPlease visit {{portalUrl}} to log in and complete your profile setup. You will be prompted to create a new password and verify your phone number on first login.',
        closingMessage: 'If you have any questions or need assistance, please don\'t hesitate to contact us.\n\nWelcome aboard!',
        signature: 'Coastal Private Lending Team'
      }
    };

    if (!defaults[name]) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Find and update template
    const template = await db.EmailTemplate.findOne({
      where: { templateName: name }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    await template.update(defaults[name]);

    res.json({
      success: true,
      message: 'Template reset to default successfully',
      template: template
    });
  } catch (error) {
    console.error('Error resetting email template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset email template'
    });
  }
};
