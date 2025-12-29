const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleSheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
  }

  /**
   * Initialize Google Sheets API with service account credentials
   */
  async initialize() {
    try {
      let credentials;

      // Try to load credentials from environment variable first (for production)
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        console.log('Loading Google credentials from environment variable...');
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      } else {
        // Fall back to file-based credentials (for local development)
        const credentialsPath = path.join(__dirname, '../../google-credentials.json');

        if (!fs.existsSync(credentialsPath)) {
          throw new Error('Google credentials not found. Please either:\n1. Add google-credentials.json to the backend directory, OR\n2. Set GOOGLE_SERVICE_ACCOUNT_KEY environment variable');
        }

        console.log('Loading Google credentials from file...');
        credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      }

      // Create JWT client
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });

      // Initialize Sheets API
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });

      console.log('✓ Google Sheets API initialized successfully');
      return true;
    } catch (error) {
      console.error('✗ Failed to initialize Google Sheets API:', error.message);
      throw error;
    }
  }

  /**
   * Read data from Google Sheet
   * @param {string} spreadsheetId - The ID of the Google Sheet
   * @param {string} range - The range to read (e.g., 'Sheet1!A1:Z100')
   * @returns {Array} - Array of row data
   */
  async readSheet(spreadsheetId, range) {
    try {
      if (!this.sheets) {
        await this.initialize();
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      });

      return response.data.values || [];
    } catch (error) {
      console.error('Error reading Google Sheet:', error.message);
      throw error;
    }
  }

  /**
   * Parse funded data from Google Sheet
   * Column mapping based on your sheet structure:
   * - Business name: Column C (index 2)
   * - Project Address: Column D (index 3)
   * - Construction Cost: Column F (index 5)
   * - Construction left in escrow: Column G (index 6)
   * - Loan Amount: Column H (index 7)
   * - Interest Rate: Column K (index 10)
   * - Interest Payment: Column M (index 12)
   * - Closing Date: Column N (index 13)
   * - Maturity Date: Column O (index 14)
   *
   * Data starts at row 7
   */
  parseFundedData(rows) {
    const fundedRecords = [];

    // Skip to row 7 (index 6) where data starts
    const dataRows = rows.slice(6);

    for (const row of dataRows) {
      // Skip empty rows or rows without business name (index 2)
      if (!row || row.length === 0) {
        continue;
      }

      const businessName = row[2] ? String(row[2]).trim() : null;

      // Skip if no business name or if it's empty after trimming
      if (!businessName) {
        continue;
      }

      // Extract data from specified columns - EXACTLY as they appear
      const fundedData = {
        businessName: businessName,                      // Column C (index 2)
        projectAddress: row[3] || null,                  // Column D (index 3) - Project Address
        constructionCost: this.parseNumber(row[5]),      // Column F (index 5)
        constructionLeftInEscrow: this.parseNumber(row[6]), // Column G (index 6)
        loanAmount: this.parseNumber(row[7]),            // Column H (index 7)
        interestRate: this.parseNumber(row[10]),         // Column K (index 10)
        interestPayment: this.parseNumber(row[12]),      // Column M (index 12)
        closingDate: this.parseDate(row[13]),            // Column N (index 13)
        maturityDate: this.parseDate(row[14])            // Column O (index 14)
      };

      fundedRecords.push(fundedData);
    }

    return fundedRecords;
  }

  /**
   * Parse numeric values (handles currency formatting)
   */
  parseNumber(value) {
    if (!value) return null;

    // Remove currency symbols, commas, and spaces
    const cleaned = String(value).replace(/[$,\s%]/g, '');
    const number = parseFloat(cleaned);

    return isNaN(number) ? null : number;
  }

  /**
   * Parse date values
   */
  parseDate(value) {
    if (!value) return null;

    try {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse asset ID to extract S001 number
   * Example: "Promissory Note - S00162962" -> "S00162962"
   */
  parseAssetId(value) {
    if (!value) return null;

    const match = String(value).match(/S001\d+/);
    return match ? match[0] : null;
  }

  /**
   * Parse promissory data from Google Sheet
   * Column mapping:
   * - Status: Column A (index 0)
   * - Investor Name: Column C (index 2) - REQUIRED
   * - Investor Email: Column D (index 3)
   * - Type: Column E (index 4) - raw value without parsing
   * - Asset ID: Column E (index 4) - parse S001 number (optional)
   * - Fund Date: Column F (index 5)
   * - Maturity Date: Column H (index 7)
   * - Loan Amount: Column J (index 9)
   * - Payoff Date: Column K (index 10)
   * - Interest Rate: Column N (index 13)
   * - Capital Pay: Column O (index 14)
   *
   * Data starts at row 5
   * Only investor name (index 2) is required - all other fields can be NULL
   */
  parsePromissoryData(rows) {
    const promissoryRecords = [];

    // Skip to row 5 (index 4) where data starts
    const dataRows = rows.slice(4);

    for (const row of dataRows) {
      // Skip empty rows
      if (!row || row.length === 0) {
        continue;
      }

      const investorName = row[2] ? String(row[2]).trim() : null;

      // Skip if no investor name or if it's empty after trimming
      if (!investorName) {
        continue;
      }

      // Extract data from specified columns - all optional except investor name
      const promissoryData = {
        status: row[0] || null,                         // Column A (index 0)
        investorName: investorName,                     // Column C (index 2) - REQUIRED
        investorEmail: row[3] || null,                  // Column D (index 3)
        type: row[4] || null,                           // Column E (index 4) - raw value
        assetId: this.parseAssetId(row[4]),             // Column E (index 4) - parsed (can be null)
        fundDate: this.parseDate(row[5]),               // Column F (index 5)
        maturityDate: this.parseDate(row[7]),           // Column H (index 7)
        loanAmount: this.parseNumber(row[9]),           // Column J (index 9)
        payoffDate: this.parseDate(row[10]),            // Column K (index 10)
        interestRate: this.parseNumber(row[13]),        // Column N (index 13)
        capitalPay: this.parseNumber(row[14])           // Column O (index 14)
      };

      promissoryRecords.push(promissoryData);
    }

    return promissoryRecords;
  }

  /**
   * Parse CRM-Borrowers data from Google Sheet
   * Column mapping:
   * - Property Address: Column B (index 1)
   * - Email: Column M (index 12)
   * - First Name: Column N (index 13)
   * - Last Name: Column P (index 15)
   */
  parseCRMBorrowersData(rows) {
    const contactMap = new Map();

    // Skip header rows and process data
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      // Skip empty rows
      if (!row || row.length === 0) {
        continue;
      }

      const propertyAddress = row[1] ? String(row[1]).trim() : null;

      // Skip if no property address or if it's empty after trimming
      if (!propertyAddress) {
        continue;
      }

      const email = row[12] || null;
      const firstName = row[13] || null;
      const lastName = row[15] || null;

      contactMap.set(propertyAddress, {
        email,
        firstName,
        lastName
      });
    }

    console.log(`Parsed ${contactMap.size} contact records from CRM-Borrowers`);
    return contactMap;
  }

  /**
   * Import funded records from Google Sheet to database with incremental sync
   * Uses composite key (businessName + projectAddress) for upsert logic
   * Tracks lastSeenAt to identify and remove stale records
   *
   * @param {string} spreadsheetId - The Google Sheet ID
   * @param {string} sheetName - The sheet name (default: 'Funded')
   * @param {Object} db - Database models
   */
  async importFunded(spreadsheetId, sheetName = 'Funded', db) {
    try {
      console.log(`Starting incremental sync from Google Sheet: ${spreadsheetId}`);

      const syncStartTime = new Date();

      // Read the Funded sheet
      const range = `${sheetName}!A:Z`;
      const rows = await this.readSheet(spreadsheetId, range);

      if (!rows || rows.length === 0) {
        throw new Error('No data found in the sheet');
      }

      console.log(`Found ${rows.length} total rows in Funded sheet`);

      // Read the CRM-Borrowers sheet
      let contactMap = new Map();
      try {
        const crmRange = 'CRM-Borrowers!A:Z';
        const crmRows = await this.readSheet(spreadsheetId, crmRange);
        if (crmRows && crmRows.length > 0) {
          contactMap = this.parseCRMBorrowersData(crmRows);
        }
      } catch (error) {
        console.warn('Could not fetch CRM-Borrowers data:', error.message);
        console.warn('Continuing without contact information...');
      }

      // Parse funded data
      const fundedData = this.parseFundedData(rows);
      console.log(`Parsed ${fundedData.length} valid funded records`);

      const results = {
        created: 0,
        updated: 0,
        failed: 0,
        errors: [],
        deleted: 0
      };

      // Process each funded record with upsert logic
      for (const record of fundedData) {
        try {
          // Skip records without composite key
          if (!record.businessName || !record.projectAddress) {
            console.log(`Skipping record without composite key: ${record.businessName || 'unknown'}`);
            continue;
          }

          // Match contact information from CRM-Borrowers by property address
          if (record.projectAddress && contactMap.has(record.projectAddress)) {
            const contactInfo = contactMap.get(record.projectAddress);
            record.email = contactInfo.email;
            record.firstName = contactInfo.firstName;
            record.lastName = contactInfo.lastName;
          }

          // Find existing record by composite key
          const existing = await db.Funded.findOne({
            where: {
              businessName: record.businessName,
              projectAddress: record.projectAddress
            }
          });

          // Set lastSeenAt to mark this record as current
          record.lastSeenAt = syncStartTime;

          if (existing) {
            // Update existing record
            await existing.update(record);
            results.updated++;
            console.log(`Updated: ${record.businessName} - ${record.projectAddress}`);
          } else {
            // Create new record
            await db.Funded.create(record);
            results.created++;
            console.log(`Created: ${record.businessName} - ${record.projectAddress}`);
          }

        } catch (error) {
          results.failed++;
          results.errors.push({
            businessName: record.businessName,
            projectAddress: record.projectAddress,
            error: error.message
          });
          console.error(`Failed to sync ${record.businessName} - ${record.projectAddress}:`, error.message);
        }
      }

      // Remove stale records (not seen in this sync)
      try {
        const { Op } = require('sequelize');
        const deleteResult = await db.Funded.destroy({
          where: {
            [Op.or]: [
              { lastSeenAt: { [Op.lt]: syncStartTime } },
              { lastSeenAt: null }
            ]
          }
        });

        results.deleted = deleteResult;
        console.log(`Deleted ${deleteResult} stale record(s) not found in sheet`);
      } catch (error) {
        console.error('Failed to clean up stale records:', error.message);
      }

      console.log('Incremental sync completed:', results);
      return results;

    } catch (error) {
      console.error('Sync failed:', error.message);
      throw error;
    }
  }

  /**
   * Import promissory records from Google Sheet to database
   * Deletes all existing records and rewrites fresh data on each sync
   *
   * @param {string} spreadsheetId - The Google Sheet ID
   * @param {string} sheetName - The sheet name (default: 'Promissory Money')
   * @param {Object} db - Database models
   */
  async importPromissory(spreadsheetId, sheetName = 'Promissory Money', db) {
    try {
      console.log(`Starting promissory sync from Google Sheet: ${spreadsheetId}`);

      // Read the Promissory Money sheet
      const range = `${sheetName}!A:Z`;
      const rows = await this.readSheet(spreadsheetId, range);

      if (!rows || rows.length === 0) {
        throw new Error('No data found in the Promissory Money sheet');
      }

      console.log(`Found ${rows.length} total rows in Promissory Money sheet`);

      // Parse promissory data
      const promissoryData = this.parsePromissoryData(rows);
      console.log(`Parsed ${promissoryData.length} valid promissory records`);

      const results = {
        created: 0,
        failed: 0,
        errors: [],
        deleted: 0
      };

      // Delete all existing promissory records
      try {
        const deleteCount = await db.Promissory.count();
        await db.Promissory.destroy({
          where: {},
          truncate: true
        });
        results.deleted = deleteCount;
        console.log(`Deleted ${deleteCount} old promissory record(s)`);
      } catch (error) {
        console.error('Failed to delete existing promissory records:', error.message);
        throw error;
      }

      // Create all records fresh
      for (const record of promissoryData) {
        try {
          await db.Promissory.create(record);
          results.created++;
          console.log(`Created: ${record.assetId || record.investorName}`);
        } catch (error) {
          results.failed++;
          results.errors.push({
            identifier: record.assetId || record.investorName,
            error: error.message
          });
          console.error(`Failed to create ${record.assetId || record.investorName}:`, error.message);
        }
      }

      console.log('Promissory sync completed:', results);
      return results;

    } catch (error) {
      console.error('Promissory sync failed:', error.message);
      throw error;
    }
  }

  /**
   * Parse cap investor data from Google Sheet
   * Column mapping:
   * - Property Address: Column B (index 1) - REQUIRED
   * - Cap Investor 1: Column C (index 2)
   * - Cap Investor 1 Loan Amount: Column D (index 3)
   * - Cap Investor 1 Interest Rate: Column F (index 5)
   * - Cap Investor 1 Payment: Column H (index 7)
   * - Cap Investor 2: Column I (index 8)
   * - Cap Investor 2 Loan Amount: Column J (index 9)
   * - Cap Investor 2 Interest Rate: Column L (index 11)
   * - Cap Investor 2 Payment: Column N (index 13)
   * - Cap Investor 3: Column O (index 14)
   * - Cap Investor 3 Loan Amount: Column P (index 15)
   * - Cap Investor 3 Interest Rate: Column R (index 17)
   * - Cap Investor 3 Payment: Column T (index 19)
   * - Fund Date: Column V (index 21)
   * - Payoff Date: Column AF (index 31)
   * - Loan Status: Column AG (index 32)
   *
   * Data starts at row 14 (index 13)
   * Creates separate rows for each investor present
   */
  parseCapInvestorData(rows) {
    const capInvestorRecords = [];

    // Skip to row 14 (index 13) where data starts
    const dataRows = rows.slice(13);

    for (const row of dataRows) {
      // Skip empty rows or rows without property address (index 1)
      if (!row || row.length === 0) {
        continue;
      }

      const propertyAddress = row[1] ? String(row[1]).trim() : null;

      // Skip if no property address or if it's empty after trimming
      if (!propertyAddress) {
        continue;
      }

      // Shared data for all investors at this property
      const fundDate = this.parseDate(row[21]);      // Column V (index 21)
      const payoffDate = this.parseDate(row[31]);    // Column AF (index 31)
      const loanStatus = row[32] || null;            // Column AG (index 32)

      // Cap Investor 1 - index 2, 3, 5, 7
      const investor1Name = row[2] ? String(row[2]).trim() : null;
      if (investor1Name) {
        capInvestorRecords.push({
          propertyAddress: propertyAddress,
          investorName: investor1Name,
          loanAmount: this.parseNumber(row[3]),       // Column D (index 3)
          interestRate: this.parseNumber(row[5]),     // Column F (index 5)
          payment: this.parseNumber(row[7]),          // Column H (index 7)
          fundDate: fundDate,
          payoffDate: payoffDate,
          loanStatus: loanStatus
        });
      }

      // Cap Investor 2 - index 8, 9, 11, 13
      const investor2Name = row[8] ? String(row[8]).trim() : null;
      if (investor2Name) {
        capInvestorRecords.push({
          propertyAddress: propertyAddress,
          investorName: investor2Name,
          loanAmount: this.parseNumber(row[9]),       // Column J (index 9)
          interestRate: this.parseNumber(row[11]),    // Column L (index 11)
          payment: this.parseNumber(row[13]),         // Column N (index 13)
          fundDate: fundDate,
          payoffDate: payoffDate,
          loanStatus: loanStatus
        });
      }

      // Cap Investor 3 - index 14, 15, 17, 19
      const investor3Name = row[14] ? String(row[14]).trim() : null;
      if (investor3Name) {
        capInvestorRecords.push({
          propertyAddress: propertyAddress,
          investorName: investor3Name,
          loanAmount: this.parseNumber(row[15]),      // Column P (index 15)
          interestRate: this.parseNumber(row[17]),    // Column R (index 17)
          payment: this.parseNumber(row[19]),         // Column T (index 19)
          fundDate: fundDate,
          payoffDate: payoffDate,
          loanStatus: loanStatus
        });
      }
    }

    return capInvestorRecords;
  }

  /**
   * Import cap investor records from Google Sheet to database with incremental sync
   * Uses composite key (propertyAddress + investorName) for upsert logic
   * Tracks lastSeenAt to identify and remove stale records
   *
   * @param {string} spreadsheetId - The Google Sheet ID
   * @param {string} sheetName - The sheet name (default: 'CRM-Cap Investor')
   * @param {Object} db - Database models
   */
  async importCapInvestor(spreadsheetId, sheetName = 'CRM-Cap Investor', db) {
    try {
      console.log(`Starting cap investor sync from Google Sheet: ${spreadsheetId}`);

      const syncStartTime = new Date();

      // Read the CRM-Cap Investor sheet
      const range = `${sheetName}!A:AG`;
      const rows = await this.readSheet(spreadsheetId, range);

      if (!rows || rows.length === 0) {
        throw new Error('No data found in the CRM-Cap Investor sheet');
      }

      console.log(`Found ${rows.length} total rows in CRM-Cap Investor sheet`);

      // Parse cap investor data
      const capInvestorData = this.parseCapInvestorData(rows);
      console.log(`Parsed ${capInvestorData.length} valid cap investor records`);

      const results = {
        created: 0,
        updated: 0,
        failed: 0,
        errors: [],
        deleted: 0
      };

      // Process each cap investor record with upsert logic
      for (const record of capInvestorData) {
        try {
          // Skip records without composite key
          if (!record.propertyAddress || !record.investorName) {
            console.log(`Skipping record without composite key: ${record.propertyAddress || 'unknown'} - ${record.investorName || 'unknown'}`);
            continue;
          }

          // Find existing record by composite key
          const existing = await db.CapInvestor.findOne({
            where: {
              propertyAddress: record.propertyAddress,
              investorName: record.investorName
            }
          });

          // Set lastSeenAt to mark this record as current
          record.lastSeenAt = syncStartTime;

          if (existing) {
            // Update existing record
            await existing.update(record);
            results.updated++;
            console.log(`Updated: ${record.propertyAddress} - ${record.investorName}`);
          } else {
            // Create new record
            await db.CapInvestor.create(record);
            results.created++;
            console.log(`Created: ${record.propertyAddress} - ${record.investorName}`);
          }

        } catch (error) {
          results.failed++;
          results.errors.push({
            propertyAddress: record.propertyAddress,
            investorName: record.investorName,
            error: error.message
          });
          console.error(`Failed to sync ${record.propertyAddress} - ${record.investorName}:`, error.message);
        }
      }

      // Remove stale records (not seen in this sync)
      try {
        const { Op } = require('sequelize');
        const deleteResult = await db.CapInvestor.destroy({
          where: {
            [Op.or]: [
              { lastSeenAt: { [Op.lt]: syncStartTime } },
              { lastSeenAt: null }
            ]
          }
        });

        results.deleted = deleteResult;
        console.log(`Deleted ${deleteResult} stale cap investor record(s) not found in sheet`);
      } catch (error) {
        console.error('Failed to clean up stale cap investor records:', error.message);
      }

      console.log('Cap investor sync completed:', results);
      return results;

    } catch (error) {
      console.error('Cap investor sync failed:', error.message);
      throw error;
    }
  }
}

module.exports = new GoogleSheetsService();
