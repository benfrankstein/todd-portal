const googleSheetsService = require('../services/googleSheetsService');
const db = require('../models');

/**
 * Import funded records from Google Sheet
 * POST /api/import/google-sheet
 * Body: { spreadsheetId: string, sheetName?: string }
 */
exports.importFromGoogleSheet = async (req, res) => {
  try {
    const { spreadsheetId, sheetName } = req.body;

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'spreadsheetId is required'
      });
    }

    // Import funded records
    const results = await googleSheetsService.importFunded(
      spreadsheetId,
      sheetName || 'Funded',
      db
    );

    res.json({
      success: true,
      message: 'Import completed',
      results
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Sync all sheets (Funded, Promissory, Cap Investor)
 * POST /api/import/sync-all
 * Uses GOOGLE_SPREADSHEET_ID from environment variables
 */
exports.syncAllSheets = async (req, res) => {
  try {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!spreadsheetId) {
      return res.status(500).json({
        success: false,
        error: 'GOOGLE_SPREADSHEET_ID not configured in environment variables'
      });
    }

    // Check if service account key is configured
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return res.status(500).json({
        success: false,
        error: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured. Please set the environment variable on Render.'
      });
    }

    console.log('Starting sync of all sheets...');

    // Initialize Google Sheets API
    try {
      await googleSheetsService.initialize();
    } catch (initError) {
      console.error('Google Sheets initialization error:', initError);
      return res.status(500).json({
        success: false,
        error: `Failed to initialize Google Sheets API: ${initError.message}`
      });
    }

    // Sync Funded data
    console.log('Syncing Funded data...');
    const fundedResults = await googleSheetsService.importFunded(
      spreadsheetId,
      'Funded',
      db
    );

    // Sync Promissory data
    console.log('Syncing Promissory data...');
    const promissoryResults = await googleSheetsService.importPromissory(
      spreadsheetId,
      'Promissory Money',
      db
    );

    // Sync Cap Investor data
    console.log('Syncing Cap Investor data...');
    const capInvestorResults = await googleSheetsService.importCapInvestor(
      spreadsheetId,
      'CRM-Cap Investor',
      db
    );

    console.log('All sheets synced successfully');

    res.json({
      success: true,
      message: 'All data synced successfully',
      results: {
        funded: fundedResults,
        promissory: promissoryResults,
        capInvestor: capInvestorResults
      }
    });

  } catch (error) {
    console.error('Sync all error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Test Google Sheets connection
 * GET /api/import/test
 */
exports.testConnection = async (req, res) => {
  try {
    await googleSheetsService.initialize();
    res.json({
      success: true,
      message: 'Google Sheets API connection successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
