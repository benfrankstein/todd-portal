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
    const { businessName, role } = req.user;

    if (!businessName) {
      return res.status(400).json({ error: 'No business name associated with your account' });
    }

    // Determine the role to query by
    let queryRole = 'client';
    if (role === 'promissory') {
      queryRole = 'investor';
    } else if (role === 'capinvestor') {
      queryRole = 'capinvestor';
    }

    // Get all invoices for this user
    const invoices = await db.Invoice.findAll({
      where: {
        businessName: businessName,
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
      businessName,
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
