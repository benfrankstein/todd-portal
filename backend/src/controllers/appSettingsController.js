const db = require('../models');

/**
 * Get a specific setting by key
 * GET /api/settings/:key
 */
exports.getSetting = async (req, res) => {
  try {
    const { key } = req.params;

    const setting = await db.AppSettings.findOne({
      where: { settingKey: key }
    });

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({
      success: true,
      setting: {
        key: setting.settingKey,
        value: setting.settingValue,
        description: setting.description
      }
    });

  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ error: 'Failed to get setting' });
  }
};

/**
 * Update a setting
 * PUT /api/settings/:key
 */
exports.updateSetting = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update settings' });
    }

    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const [setting, created] = await db.AppSettings.upsert({
      settingKey: key,
      settingValue: value
    }, {
      returning: true
    });

    // Get the actual record (upsert returns array with instance and created flag)
    const settingRecord = Array.isArray(setting) ? setting[0] : setting;

    res.json({
      success: true,
      message: created ? 'Setting created successfully' : 'Setting updated successfully',
      setting: {
        key: settingRecord.settingKey,
        value: settingRecord.settingValue,
        description: settingRecord.description
      }
    });

  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
};

/**
 * Get all settings (admin only)
 * GET /api/settings
 */
exports.getAllSettings = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view all settings' });
    }

    const settings = await db.AppSettings.findAll({
      order: [['settingKey', 'ASC']]
    });

    res.json({
      success: true,
      settings: settings.map(s => ({
        key: s.settingKey,
        value: s.settingValue,
        description: s.description
      }))
    });

  } catch (error) {
    console.error('Get all settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
};
