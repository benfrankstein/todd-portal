/**
 * Email Service - Gmail API (REST/HTTPS) with Nodemailer MIME builder
 * Handles sending invoice emails to clients and investors using Gmail API
 * Uses nodemailer to build proper MIME messages
 */

const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const db = require('../models');

/**
 * Create OAuth2 client for Gmail API
 */
function createOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.EMAIL_CLIENT_ID,
    process.env.EMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.EMAIL_REFRESH_TOKEN
  });

  return oauth2Client;
}

/**
 * Create Gmail API client
 */
async function createGmailClient() {
  try {
    console.log('     → Creating Gmail API client...');
    const oauth2Client = createOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    console.log('     → Gmail API client created');
    return gmail;
  } catch (error) {
    console.error('Error creating Gmail API client:', error.message);
    throw error;
  }
}

/**
 * Create MIME message for Gmail API using nodemailer's message builder
 * This ensures proper MIME encoding that Gmail can preview
 */
async function createMimeMessage(to, from, replyTo, subject, textContent, htmlContent, attachments = []) {
  return new Promise((resolve, reject) => {
    const mailOptions = {
      from: from,
      to: to,
      replyTo: replyTo,
      subject: subject,
      text: textContent,
      html: htmlContent,
      attachments: attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType
      }))
    };

    // Create a nodemailer transport (we won't use it to send, just to build the message)
    const transport = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix'
    });

    // Build the message
    const mail = transport.sendMail(mailOptions, (err, info) => {
      if (err) {
        reject(err);
      } else {
        // Read the message stream
        let message = '';
        info.message.on('data', (chunk) => {
          message += chunk.toString('utf8');
        });
        info.message.on('end', () => {
          resolve(message);
        });
      }
    });
  });
}

/**
 * Replace template variables with actual values
 */
function replaceTemplateVariables(text, data) {
  return text
    .replace(/\{\{businessName\}\}/g, data.businessName)
    .replace(/\{\{month\}\}/g, data.month)
    .replace(/\{\{year\}\}/g, data.year)
    .replace(/\{\{formattedDate\}\}/g, data.formattedDate)
    .replace(/\{\{totalAmount\}\}/g, data.totalAmount)
    .replace(/\{\{amountLabel\}\}/g, data.amountLabel);
}

/**
 * Generate email HTML template for invoice
 */
async function generateInvoiceEmailHTML(businessName, role, invoiceDate, totalAmount, template) {
  // Format date without timezone conversion (use UTC values directly)
  const year = invoiceDate.getUTCFullYear();
  const month = invoiceDate.getUTCMonth();
  const day = invoiceDate.getUTCDate();
  const dateObj = new Date(year, month, day); // Local date without timezone offset

  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' });
  const yearStr = dateObj.toLocaleDateString('en-US', { year: 'numeric' });

  const formatCurrency = (val) => `$${parseFloat(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Determine amount label
  let amountLabel = '';
  if (role === 'client' || role === 'borrower') {
    amountLabel = 'Total Interest Due';
  } else {
    amountLabel = 'Total Interest Earned';
  }

  // Prepare template data for replacement
  const templateData = {
    businessName: businessName,
    month: monthName,
    year: yearStr,
    formattedDate: formattedDate,
    totalAmount: formatCurrency(totalAmount),
    amountLabel: amountLabel
  };

  // Replace variables in template fields
  const greeting = replaceTemplateVariables(template.greeting, templateData);
  const message = replaceTemplateVariables(template.bodyMessage, templateData);
  const closingMessage = replaceTemplateVariables(template.closingMessage, templateData);
  const signature = replaceTemplateVariables(template.signature, templateData);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monthly Invoice - ${formattedDate}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Coastal Private Lending</h1>
              <p style="color: #E0E7FF; margin: 10px 0 0 0; font-size: 16px;">Monthly Invoice Statement</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">${greeting},</p>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">${message}</p>

              <!-- Invoice Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3F4F6; border-radius: 6px; margin: 30px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #666666; font-size: 14px; font-weight: bold;">Business Name:</td>
                        <td style="color: #333333; font-size: 14px; text-align: right;">${businessName}</td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px; font-weight: bold;">Invoice Date:</td>
                        <td style="color: #333333; font-size: 14px; text-align: right;">${formattedDate}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-top: 2px solid #D1D5DB; padding-top: 12px; margin-top: 8px;"></td>
                      </tr>
                      <tr>
                        <td style="color: #1E3A8A; font-size: 16px; font-weight: bold;">${amountLabel}:</td>
                        <td style="color: #1E3A8A; font-size: 18px; font-weight: bold; text-align: right;">${formatCurrency(totalAmount)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0; white-space: pre-line;">
                ${closingMessage}
              </p>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
                <strong>${signature}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                <strong>Coastal Private Lending</strong>
              </p>
              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                30 E. Padonia Rd., Suite 206 • Timonium, MD 21093
              </p>
              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                📧 ashley@coastalprivatelending.com | 📞 (410) 369-6337
              </p>
              <p style="color: #666666; font-size: 14px; margin: 0;">
                <a href="http://www.CoastalPrivateLending.com" style="color: #2563EB; text-decoration: none;">www.CoastalPrivateLending.com</a>
              </p>
            </td>
          </tr>

        </table>

        <!-- Legal Footer -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
          <tr>
            <td style="text-align: center; padding: 0 30px;">
              <p style="color: #999999; font-size: 12px; line-height: 1.4; margin: 0;">
                This email and any attachments are confidential and intended solely for the addressee.
                If you received this email in error, please delete it and notify us immediately.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of email (fallback for non-HTML clients)
 */
async function generateInvoiceEmailText(businessName, role, invoiceDate, totalAmount, template) {
  // Format date without timezone conversion (use UTC values directly)
  const year = invoiceDate.getUTCFullYear();
  const month = invoiceDate.getUTCMonth();
  const day = invoiceDate.getUTCDate();
  const dateObj = new Date(year, month, day); // Local date without timezone offset

  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' });
  const yearStr = dateObj.toLocaleDateString('en-US', { year: 'numeric' });

  const formatCurrency = (val) => `$${parseFloat(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Determine amount label
  let amountLabel = '';
  if (role === 'client' || role === 'borrower') {
    amountLabel = 'Total Interest Due';
  } else {
    amountLabel = 'Total Interest Earned';
  }

  // Prepare template data for replacement
  const templateData = {
    businessName: businessName,
    month: monthName,
    year: yearStr,
    formattedDate: formattedDate,
    totalAmount: formatCurrency(totalAmount),
    amountLabel: amountLabel
  };

  // Replace variables in template fields
  const greeting = replaceTemplateVariables(template.greeting, templateData);
  const message = replaceTemplateVariables(template.bodyMessage, templateData);
  const closingMessage = replaceTemplateVariables(template.closingMessage, templateData);
  const signature = replaceTemplateVariables(template.signature, templateData);

  return `
COASTAL PRIVATE LENDING
Monthly Invoice Statement

${greeting},

${message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVOICE DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Business Name: ${businessName}
Invoice Date: ${formattedDate}
${amountLabel}: ${formatCurrency(totalAmount)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${closingMessage}

${signature}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Coastal Private Lending
30 E. Padonia Rd., Suite 206 • Timonium, MD 21093
Email: support@coastalprivate.com
Phone: (410) 555-8290
Web: www.CoastalPrivateLending.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This email and any attachments are confidential and intended solely for the addressee.
  `.trim();
}

/**
 * Send invoice email with PDF attachment
 *
 * @param {string} recipientEmail - Recipient's email address
 * @param {string} businessName - Business/Investor name
 * @param {string} role - User role (client, investor, capinvestor)
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} fileName - PDF filename
 * @param {Date} invoiceDate - Invoice date
 * @param {number} totalAmount - Total amount (interest due or earned)
 * @returns {Promise<Object>} - Result with success status and message
 */
async function sendInvoiceEmail(recipientEmail, businessName, role, pdfBuffer, fileName, invoiceDate, totalAmount) {
  try {
    // Validate environment variables
    if (!process.env.EMAIL_CLIENT_ID || !process.env.EMAIL_CLIENT_SECRET || !process.env.EMAIL_REFRESH_TOKEN) {
      throw new Error('Missing required email environment variables');
    }

    // Determine template name based on role
    let templateName = 'invoice_client';
    if (role === 'investor' || role === 'promissory') {
      templateName = 'invoice_investor';
    } else if (role === 'capinvestor') {
      templateName = 'invoice_capinvestor';
    }

    // Fetch email template from database
    const template = await db.EmailTemplate.findOne({
      where: { templateName: templateName, isActive: true }
    });

    if (!template) {
      throw new Error(`Email template '${templateName}' not found`);
    }

    // Log template details for debugging
    console.log(`  → Using email template: ${templateName}`);
    console.log(`     Subject: ${template.subject.substring(0, 50)}${template.subject.length > 50 ? '...' : ''}`);

    // Create Gmail API client
    const gmail = await createGmailClient();

    // Format date for subject (without timezone conversion)
    const year = invoiceDate.getUTCFullYear();
    const month = invoiceDate.getUTCMonth();
    const day = invoiceDate.getUTCDate();
    const dateObj = new Date(year, month, day); // Local date without timezone offset

    const formattedDate = dateObj.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

    const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' });
    const yearStr = dateObj.toLocaleDateString('en-US', { year: 'numeric' });

    const formatCurrency = (val) => `$${parseFloat(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Determine amount label
    let amountLabel = '';
    if (role === 'client' || role === 'borrower') {
      amountLabel = 'Total Interest Due';
    } else {
      amountLabel = 'Total Interest Earned';
    }

    // Prepare template data for subject replacement
    const templateData = {
      businessName: businessName,
      month: monthName,
      year: yearStr,
      formattedDate: formattedDate,
      totalAmount: formatCurrency(totalAmount),
      amountLabel: amountLabel
    };

    // Replace variables in subject
    const subject = replaceTemplateVariables(template.subject, templateData);

    // Generate email HTML and text with template
    console.log(`  → Generating email content...`);
    const html = await generateInvoiceEmailHTML(businessName, role, invoiceDate, totalAmount, template);
    const text = await generateInvoiceEmailText(businessName, role, invoiceDate, totalAmount, template);

    // Create MIME message using nodemailer (ensures proper encoding)
    console.log(`  → Creating MIME message (PDF: ${(pdfBuffer.length / 1024).toFixed(2)} KB)...`);
    const mimeMessage = await createMimeMessage(
      recipientEmail,
      `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_USER}>`,
      process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER,
      subject,
      text,
      html,
      [{
        filename: fileName,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    );

    // Encode message in base64url format
    const encodedMessage = Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send email via Gmail API
    console.log(`  → Sending email via Gmail API to ${recipientEmail}...`);
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log(`✓ Email sent to ${recipientEmail}: ${result.data.id}`);

    return {
      success: true,
      messageId: result.data.id,
      recipient: recipientEmail
    };

  } catch (error) {
    console.error(`✗ Failed to send email to ${recipientEmail}:`, error.message);

    return {
      success: false,
      error: error.message,
      recipient: recipientEmail
    };
  }
}

/**
 * Generate HTML template for password reset email
 */
function generatePasswordResetEmailHTML(firstName, resetLink) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Coastal Private Lending</h1>
              <p style="color: #E0E7FF; margin: 10px 0 0 0; font-size: 16px;">Password Reset Request</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hello ${firstName},</p>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                We received a request to reset your password for your Coastal Private Lending portal account. Click the button below to create a new password:
              </p>

              <!-- Reset Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Reset My Password</a>
                  </td>
                </tr>
              </table>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                Or copy and paste this link into your browser:
              </p>

              <p style="color: #2563EB; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; word-break: break-all;">
                ${resetLink}
              </p>

              <!-- Warning Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 4px; margin: 30px 0;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="color: #92400E; font-size: 14px; line-height: 1.6; margin: 0;">
                      <strong>Important:</strong> This password reset link will expire in 1 hour for security reasons. If you didn't request this password reset, please ignore this email or contact us if you have concerns.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
                Thank you,
              </p>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 5px 0 0 0;">
                <strong>Coastal Private Lending Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                <strong>Coastal Private Lending</strong>
              </p>
              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                30 E. Padonia Rd., Suite 206 • Timonium, MD 21093
              </p>
              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                📧 ashley@coastalprivatelending.com | 📞 (410) 369-6337
              </p>
              <p style="color: #666666; font-size: 14px; margin: 0;">
                <a href="http://www.CoastalPrivateLending.com" style="color: #2563EB; text-decoration: none;">www.CoastalPrivateLending.com</a>
              </p>
            </td>
          </tr>

        </table>

        <!-- Legal Footer -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
          <tr>
            <td style="text-align: center; padding: 0 30px;">
              <p style="color: #999999; font-size: 12px; line-height: 1.4; margin: 0;">
                This email and any attachments are confidential and intended solely for the addressee.
                If you received this email in error, please delete it and notify us immediately.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of password reset email
 */
function generatePasswordResetEmailText(firstName, resetLink) {
  return `
COASTAL PRIVATE LENDING
Password Reset Request

Hello ${firstName},

We received a request to reset your password for your Coastal Private Lending portal account.

To reset your password, copy and paste this link into your browser:

${resetLink}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT: This password reset link will expire in 1 hour for security reasons.

If you didn't request this password reset, please ignore this email or contact us if you have concerns.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Thank you,
Coastal Private Lending Team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Coastal Private Lending
30 E. Padonia Rd., Suite 206 • Timonium, MD 21093
Email: ashley@coastalprivatelending.com
Phone: (410) 369-6337
Web: www.CoastalPrivateLending.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This email and any attachments are confidential and intended solely for the addressee.
  `.trim();
}

/**
 * Send password reset email with reset link
 *
 * @param {string} recipientEmail - Recipient's email address
 * @param {string} firstName - User's first name
 * @param {string} resetToken - Password reset token
 * @returns {Promise<Object>} - Result with success status and message
 */
async function sendPasswordResetEmail(recipientEmail, firstName, resetToken) {
  try {
    // Validate environment variables
    if (!process.env.EMAIL_CLIENT_ID || !process.env.EMAIL_CLIENT_SECRET || !process.env.EMAIL_REFRESH_TOKEN) {
      throw new Error('Missing required email environment variables');
    }

    // Get frontend URL from environment or use default
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Create Gmail API client
    const gmail = await createGmailClient();

    // Generate email HTML and text
    const html = generatePasswordResetEmailHTML(firstName, resetLink);
    const text = generatePasswordResetEmailText(firstName, resetLink);

    // Create MIME message
    const mimeMessage = await createMimeMessage(
      recipientEmail,
      `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_USER}>`,
      process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER,
      'Password Reset Request - Coastal Private Lending',
      text,
      html
    );

    // Encode and send via Gmail API
    const encodedMessage = Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log(`✓ Password reset email sent to ${recipientEmail}: ${result.data.id}`);

    return {
      success: true,
      messageId: result.data.id,
      recipient: recipientEmail
    };

  } catch (error) {
    console.error(`✗ Failed to send password reset email to ${recipientEmail}:`, error.message);

    return {
      success: false,
      error: error.message,
      recipient: recipientEmail
    };
  }
}

/**
 * Test email configuration by sending a test email
 */
async function testEmailConfiguration(testRecipient) {
  try {
    const gmail = await createGmailClient();

    const text = 'This is a test email from your Coastal Private Lending invoice system. If you received this, your email configuration is working correctly!';
    const html = '<p>This is a test email from your <strong>Coastal Private Lending invoice system</strong>.</p><p>If you received this, your email configuration is working correctly! ✅</p>';

    // Create MIME message
    const mimeMessage = await createMimeMessage(
      testRecipient,
      `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_USER}>`,
      process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER,
      'Test Email - Coastal Private Lending Invoice System',
      text,
      html
    );

    // Encode and send via Gmail API
    const encodedMessage = Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log('✓ Test email sent successfully:', result.data.id);
    return { success: true, messageId: result.data.id };

  } catch (error) {
    console.error('✗ Test email failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Replace welcome template variables with actual values
 */
function replaceWelcomeTemplateVariables(text, data) {
  return text
    .replace(/\{\{firstName\}\}/g, data.firstName)
    .replace(/\{\{email\}\}/g, data.email)
    .replace(/\{\{password\}\}/g, data.password)
    .replace(/\{\{portalUrl\}\}/g, data.portalUrl);
}

/**
 * Generate HTML template for welcome email
 */
function generateWelcomeEmailHTML(firstName, email, password, portalUrl, template) {
  // Prepare template data for replacement
  const templateData = {
    firstName: firstName,
    email: email,
    password: password,
    portalUrl: portalUrl
  };

  // Replace variables in template fields
  const greeting = replaceWelcomeTemplateVariables(template.greeting, templateData);
  const message = replaceWelcomeTemplateVariables(template.bodyMessage, templateData);
  const closingMessage = replaceWelcomeTemplateVariables(template.closingMessage, templateData);
  const signature = replaceWelcomeTemplateVariables(template.signature, templateData);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Coastal Private Lending</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Coastal Private Lending</h1>
              <p style="color: #E0E7FF; margin: 10px 0 0 0; font-size: 16px;">Welcome to the Portal</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">${greeting},</p>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; white-space: pre-line;">
                ${message}
              </p>

              <!-- Login Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Access Portal</a>
                  </td>
                </tr>
              </table>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0; white-space: pre-line;">
                ${closingMessage}
              </p>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
                <strong>${signature}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                <strong>Coastal Private Lending</strong>
              </p>
              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                30 E. Padonia Rd., Suite 206 • Timonium, MD 21093
              </p>
              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                📧 ashley@coastalprivatelending.com | 📞 (410) 369-6337
              </p>
              <p style="color: #666666; font-size: 14px; margin: 0;">
                <a href="http://www.CoastalPrivateLending.com" style="color: #2563EB; text-decoration: none;">www.CoastalPrivateLending.com</a>
              </p>
            </td>
          </tr>

        </table>

        <!-- Legal Footer -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
          <tr>
            <td style="text-align: center; padding: 0 30px;">
              <p style="color: #999999; font-size: 12px; line-height: 1.4; margin: 0;">
                This email and any attachments are confidential and intended solely for the addressee.
                If you received this email in error, please delete it and notify us immediately.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of welcome email
 */
function generateWelcomeEmailText(firstName, email, password, portalUrl, template) {
  // Prepare template data for replacement
  const templateData = {
    firstName: firstName,
    email: email,
    password: password,
    portalUrl: portalUrl
  };

  // Replace variables in template fields
  const greeting = replaceWelcomeTemplateVariables(template.greeting, templateData);
  const message = replaceWelcomeTemplateVariables(template.bodyMessage, templateData);
  const closingMessage = replaceWelcomeTemplateVariables(template.closingMessage, templateData);
  const signature = replaceWelcomeTemplateVariables(template.signature, templateData);

  return `
COASTAL PRIVATE LENDING
Welcome to the Portal

${greeting},

${message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${closingMessage}

${signature}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Coastal Private Lending
30 E. Padonia Rd., Suite 206 • Timonium, MD 21093
Email: ashley@coastalprivatelending.com
Phone: (410) 369-6337
Web: www.CoastalPrivateLending.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This email and any attachments are confidential and intended solely for the addressee.
  `.trim();
}

/**
 * Send welcome email to newly created user
 *
 * @param {string} recipientEmail - Recipient's email address
 * @param {string} firstName - User's first name
 * @param {string} temporaryPassword - Temporary password for first login
 * @returns {Promise<Object>} - Result with success status and message
 */
async function sendWelcomeEmail(recipientEmail, firstName, temporaryPassword) {
  try {
    // Validate environment variables
    if (!process.env.EMAIL_CLIENT_ID || !process.env.EMAIL_CLIENT_SECRET || !process.env.EMAIL_REFRESH_TOKEN) {
      throw new Error('Missing required email environment variables');
    }

    // Fetch email template from database
    const template = await db.EmailTemplate.findOne({
      where: { templateName: 'user_welcome', isActive: true }
    });

    if (!template) {
      throw new Error('Email template \'user_welcome\' not found');
    }

    // Get frontend URL from environment or use default
    const portalUrl = process.env.FRONTEND_URL || 'https://cplportal.com';

    // Create Gmail API client
    const gmail = await createGmailClient();

    // Generate email HTML and text with template
    const html = generateWelcomeEmailHTML(firstName, recipientEmail, temporaryPassword, portalUrl, template);
    const text = generateWelcomeEmailText(firstName, recipientEmail, temporaryPassword, portalUrl, template);

    // Prepare template data for subject replacement
    const templateData = {
      firstName: firstName,
      email: recipientEmail,
      password: temporaryPassword,
      portalUrl: portalUrl
    };

    // Replace variables in subject
    const subject = replaceWelcomeTemplateVariables(template.subject, templateData);

    // Create MIME message
    const mimeMessage = await createMimeMessage(
      recipientEmail,
      `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_USER}>`,
      process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER,
      subject,
      text,
      html
    );

    // Encode and send via Gmail API
    const encodedMessage = Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log(`✓ Welcome email sent to ${recipientEmail}: ${result.data.id}`);

    return {
      success: true,
      messageId: result.data.id,
      recipient: recipientEmail
    };

  } catch (error) {
    console.error(`✗ Failed to send welcome email to ${recipientEmail}:`, error.message);

    return {
      success: false,
      error: error.message,
      recipient: recipientEmail
    };
  }
}

module.exports = {
  sendInvoiceEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  testEmailConfiguration
};
