require('dotenv').config();
const googleSheetsService = require('./src/services/googleSheetsService');
const db = require('./src/models');

// Get spreadsheet ID from environment or command line
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || process.argv[2];

async function syncData() {
  try {
    if (!SPREADSHEET_ID) {
      console.error('❌ Error: GOOGLE_SPREADSHEET_ID is required');
      console.log('\nUsage:');
      console.log('  node sync-data.js YOUR_SPREADSHEET_ID');
      console.log('Or set GOOGLE_SPREADSHEET_ID in your .env file');
      process.exit(1);
    }

    console.log('🔄 Starting data sync...');
    console.log(`📄 Spreadsheet ID: ${SPREADSHEET_ID}`);
    console.log('');

    // Initialize Google Sheets API
    await googleSheetsService.initialize();

    // Sync data from Funded and CRM-Borrowers sheets
    console.log('📊 Syncing Funded data...\n');
    const fundedResults = await googleSheetsService.importFunded(
      SPREADSHEET_ID,
      'Funded',
      db
    );

    // Sync data from Promissory Money sheet
    console.log('\n📊 Syncing Promissory data...\n');
    const promissoryResults = await googleSheetsService.importPromissory(
      SPREADSHEET_ID,
      'Promissory Money',
      db
    );

    // Sync data from CRM-Cap Investor sheet
    console.log('\n📊 Syncing Cap Investor data...\n');
    const capInvestorResults = await googleSheetsService.importCapInvestor(
      SPREADSHEET_ID,
      'CRM-Cap Investor',
      db
    );

    console.log('\n✅ Data sync completed!');
    console.log('');
    console.log('=== Funded Results ===');
    console.log(`  - Created: ${fundedResults.created} records`);
    console.log(`  - Updated: ${fundedResults.updated} records`);
    console.log(`  - Deleted: ${fundedResults.deleted} stale records`);
    console.log(`  - Failed: ${fundedResults.failed} records`);

    console.log('');
    console.log('=== Promissory Results ===');
    console.log(`  - Deleted: ${promissoryResults.deleted} old records`);
    console.log(`  - Created: ${promissoryResults.created} fresh records`);
    console.log(`  - Failed: ${promissoryResults.failed} records`);

    console.log('');
    console.log('=== Cap Investor Results ===');
    console.log(`  - Created: ${capInvestorResults.created} records`);
    console.log(`  - Updated: ${capInvestorResults.updated} records`);
    console.log(`  - Deleted: ${capInvestorResults.deleted} stale records`);
    console.log(`  - Failed: ${capInvestorResults.failed} records`);

    if (fundedResults.errors && fundedResults.errors.length > 0) {
      console.log('\n⚠️  Funded Errors:');
      fundedResults.errors.forEach(err => {
        console.log(`  - ${err.businessName} - ${err.projectAddress}: ${err.error}`);
      });
    }

    if (promissoryResults.errors && promissoryResults.errors.length > 0) {
      console.log('\n⚠️  Promissory Errors:');
      promissoryResults.errors.forEach(err => {
        console.log(`  - ${err.identifier}: ${err.error}`);
      });
    }

    if (capInvestorResults.errors && capInvestorResults.errors.length > 0) {
      console.log('\n⚠️  Cap Investor Errors:');
      capInvestorResults.errors.forEach(err => {
        console.log(`  - ${err.propertyAddress} - ${err.investorName}: ${err.error}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

syncData();
