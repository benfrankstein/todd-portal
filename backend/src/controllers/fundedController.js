const db = require('../models');

/**
 * Get funded records for logged-in user's business
 * GET /api/funded/my-records
 */
exports.getMyFundedRecords = async (req, res) => {
  try {
    // Get all business names (primary + additional)
    const allBusinessNames = req.user.getAllBusinessNames();

    if (allBusinessNames.length === 0) {
      return res.status(400).json({ error: 'No business name associated with your account' });
    }

    // Query for records matching ANY of the user's business names
    const records = await db.Funded.findAll({
      where: {
        businessName: {
          [db.Sequelize.Op.in]: allBusinessNames
        }
      },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      businessNames: allBusinessNames,
      count: records.length,
      records
    });

  } catch (error) {
    console.error('Get funded records error:', error);
    res.status(500).json({ error: 'Failed to get funded records' });
  }
};

/**
 * Get all funded records (admin only)
 * GET /api/funded/all
 */
exports.getAllFundedRecords = async (req, res) => {
  try {
    const records = await db.Funded.findAll({
      order: [['businessName', 'ASC'], ['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      count: records.length,
      records
    });

  } catch (error) {
    console.error('Get all funded records error:', error);
    res.status(500).json({ error: 'Failed to get funded records' });
  }
};
