const db = require('../models');

/**
 * Get promissory records for the logged-in investor
 * GET /api/promissory/my-records
 */
exports.getMyRecords = async (req, res) => {
  try {
    const { businessName } = req.user;

    if (!businessName) {
      return res.status(400).json({ error: 'No investor name associated with this account' });
    }

    // Get all promissory records for this investor
    const records = await db.Promissory.findAll({
      where: {
        investorName: businessName
      },
      order: [['maturityDate', 'ASC']]
    });

    res.json({
      success: true,
      records,
      investorName: businessName
    });

  } catch (error) {
    console.error('Get my promissory records error:', error);
    res.status(500).json({ error: 'Failed to get promissory records' });
  }
};

/**
 * Get all promissory records (admin only)
 * GET /api/promissory/all
 */
exports.getAllRecords = async (req, res) => {
  try {
    const records = await db.Promissory.findAll({
      order: [['investorName', 'ASC'], ['maturityDate', 'ASC']]
    });

    res.json({
      success: true,
      records
    });

  } catch (error) {
    console.error('Get all promissory records error:', error);
    res.status(500).json({ error: 'Failed to get promissory records' });
  }
};
