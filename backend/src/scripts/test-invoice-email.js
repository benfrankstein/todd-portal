#!/usr/bin/env node
/**
 * Test Invoice Email - Generate and send a single invoice for testing
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const db = require('../models');
const { sendInvoiceEmail } = require('../services/emailService');

async function testInvoiceEmail() {
  console.log('='.repeat(80));
  console.log('Testing Invoice Email System');
  console.log('='.repeat(80));

  try {
    // Find a recent invoice
    const invoice = await db.Invoice.findOne({
      where: {
        businessName: 'Odessa Property Management LLC',
        role: 'client'
      },
      order: [['invoiceDate', 'DESC']],
      raw: true
    });

    if (!invoice) {
      console.log('\n❌ No invoice found for testing.');
      console.log('Please run generate-invoices.js first to create invoices.');
      process.exit(1);
    }

    console.log('\n✓ Found invoice:', invoice.fileName);
    console.log('  Business:', invoice.businessName);
    console.log('  Role:', invoice.role);
    console.log('  Date:', invoice.invoiceDate);
    console.log('  Amount:', invoice.totalAmount);
    console.log('  Email sent:', invoice.emailSent);
    console.log('  Recipient:', invoice.emailRecipient || 'N/A');

    // Find user email
    const user = await db.User.findOne({
      where: {
        businessName: invoice.businessName,
        email: 'benjamin.frankstein@gmail.com' // Your email for testing
      }
    });

    if (!user) {
      console.log('\n❌ No user found with email benjamin.frankstein@gmail.com');
      process.exit(1);
    }

    console.log('\n✓ Found user:', user.email);

    // Get PDF from S3
    console.log('\n→ Downloading PDF from S3...');
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-2'
    });

    const pdfData = await s3.getObject({
      Bucket: process.env.S3_BUCKET_NAME || 'coastal-lending-invoices',
      Key: invoice.s3Key
    }).promise();

    console.log('✓ PDF downloaded:', pdfData.Body.length, 'bytes');

    // Send test email
    console.log('\n→ Sending test invoice email to', user.email, '...');

    const invoiceDate = new Date(invoice.invoiceDate);
    const result = await sendInvoiceEmail(
      user.email,
      invoice.businessName,
      invoice.role,
      pdfData.Body,
      invoice.fileName,
      invoiceDate,
      parseFloat(invoice.totalAmount)
    );

    if (result.success) {
      console.log('\n✅ SUCCESS! Test email sent');
      console.log('   Message ID:', result.messageId);
      console.log('   Recipient:', result.recipient);
      console.log('\n📧 Check your inbox at', user.email);
    } else {
      console.log('\n❌ FAILED to send email');
      console.log('   Error:', result.error);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

testInvoiceEmail();
