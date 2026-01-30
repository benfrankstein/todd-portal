const db = require('../models');
const AWS = require('aws-sdk');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-2',
  signatureVersion: 'v4'
});

const S3_BUCKET = process.env.S3_BUCKET_NAME || 'coastal-lending-invoices';

/**
 * Get invoices for logged-in user's business/investor
 * GET /api/invoices/my-invoices
 */
exports.getMyInvoices = async (req, res) => {
  try {
    const { role } = req.user;

    // Get all business names (primary + additional)
    const allBusinessNames = req.user.getAllBusinessNames();

    if (allBusinessNames.length === 0) {
      return res.status(400).json({ error: 'No business name associated with your account' });
    }

    // Determine the role to query by
    let queryRole = 'client';
    if (role === 'promissory') {
      queryRole = 'investor';
    } else if (role === 'capinvestor') {
      queryRole = 'capinvestor';
    }

    // Get all invoices for ANY of this user's business names
    const invoices = await db.Invoice.findAll({
      where: {
        businessName: {
          [db.Sequelize.Op.in]: allBusinessNames
        },
        role: queryRole
      },
      order: [['invoiceDate', 'DESC']]
    });

    // Generate pre-signed URLs for each invoice (valid for 1 hour)
    const invoicesWithSignedUrls = invoices.map(invoice => {
      const signedUrl = s3.getSignedUrl('getObject', {
        Bucket: S3_BUCKET,
        Key: invoice.s3Key,
        Expires: 3600 // 1 hour
      });

      return {
        ...invoice.toJSON(),
        downloadUrl: signedUrl
      };
    });

    res.json({
      success: true,
      businessNames: allBusinessNames,
      count: invoicesWithSignedUrls.length,
      invoices: invoicesWithSignedUrls
    });

  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
};

/**
 * Get all invoices (admin only)
 * GET /api/invoices/all
 */
exports.getAllInvoices = async (req, res) => {
  try {
    const invoices = await db.Invoice.findAll({
      order: [['invoiceDate', 'DESC'], ['businessName', 'ASC']]
    });

    res.json({
      success: true,
      count: invoices.length,
      invoices
    });

  } catch (error) {
    console.error('Get all invoices error:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
};

/**
 * Generate invoices for all businesses and investors (admin only)
 * POST /api/invoices/generate
 */
exports.generateInvoices = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can generate invoices' });
    }

    // Import the invoice generation script
    const { main: generateInvoicesMain } = require('../scripts/generate-invoices');

    // Send response immediately to avoid timeout
    res.json({
      success: true,
      message: 'Invoice generation started. This process may take several minutes.'
    });

    // Run invoice generation in background
    console.log('Starting invoice generation...');
    generateInvoicesMain()
      .then((result) => {
        console.log('\n✓ Invoice generation completed successfully!');
        console.log(`  - Total processed: ${result.stats.totalProcessed}`);
        console.log(`  - Emails sent: ${result.stats.totalEmailsSent}`);
        console.log(`  - Server continues running normally\n`);
      })
      .catch(error => {
        console.error('\n✗ Invoice generation failed:', error);
        console.error('  - Server continues running normally\n');
      });

  } catch (error) {
    console.error('Generate invoices error:', error);
    res.status(500).json({ error: 'Failed to start invoice generation' });
  }
};
