const db = require('../models');

/**
 * Get cap investor records for the logged-in cap investor
 * GET /api/capinvestor/my-records
 */
exports.getMyRecords = async (req, res) => {
  try {
    const { businessName } = req.user;

    if (!businessName) {
      return res.status(400).json({ error: 'No investor name associated with this account' });
    }

    // Get all cap investor records for this investor
    const records = await db.CapInvestor.findAll({
      where: {
        investorName: businessName
      },
      order: [['propertyAddress', 'ASC']]
    });

    res.json({
      success: true,
      records,
      investorName: businessName
    });

  } catch (error) {
    console.error('Get my cap investor records error:', error);
    res.status(500).json({ error: 'Failed to get cap investor records' });
  }
};

/**
 * Get all cap investor records (admin only)
 * GET /api/capinvestor/all
 */
exports.getAllRecords = async (req, res) => {
  try {
    const records = await db.CapInvestor.findAll({
      order: [['investorName', 'ASC'], ['propertyAddress', 'ASC']]
    });

    res.json({
      success: true,
      records
    });

  } catch (error) {
    console.error('Get all cap investor records error:', error);
    res.status(500).json({ error: 'Failed to get cap investor records' });
  }
};
