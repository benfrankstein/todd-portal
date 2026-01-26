#!/usr/bin/env node
/**
 * Coastal Private Lending - Monthly Invoice Generator (Node.js)
 * Generates invoice PDFs for all businesses and investors and uploads to S3
 */

const path = require('path');

// Load environment variables (optional for Render Cron Jobs)
try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch (err) {
  console.log('dotenv not available - using environment variables from system');
}

const puppeteer = require('puppeteer');
const AWS = require('aws-sdk');
const db = require('../models');
const fs = require('fs').promises;
const { sendInvoiceEmail } = require('../services/emailService');

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-2',
  signatureVersion: 'v4'
});

const S3_BUCKET = process.env.S3_BUCKET_NAME || 'coastal-lending-invoices';

/**
 * Get the number of days in a specific month
 * @param {number} year - Full year (e.g., 2025)
 * @param {number} month - Month (0-11, where 0 = January)
 * @returns {number} Number of days in the month
 */
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calculate proration for first month invoice
 * Invoice is generated on the 1st of the month following the fund/closing date
 * and covers the period from fund/closing date to end of that month
 *
 * IMPORTANT: Always uses 30-day months for proration calculations
 *
 * @param {Date} fundDate - The fund/closing date
 * @param {number} monthlyPayment - The full monthly payment amount
 * @returns {Object} Proration details or null if not applicable
 */
function calculateFirstMonthProration(fundDate, monthlyPayment) {
  if (!fundDate || !monthlyPayment) return null;

  const fund = new Date(fundDate);
  const fundYear = fund.getFullYear();
  const fundMonth = fund.getMonth();
  const fundDay = fund.getDate();

  // Calculate last day of the fund month
  const daysInFundMonth = getDaysInMonth(fundYear, fundMonth);
  const periodStart = new Date(fundYear, fundMonth, fundDay);
  const periodEnd = new Date(fundYear, fundMonth, daysInFundMonth);

  // Calculate days in period (inclusive)
  const daysInPeriod = daysInFundMonth - fundDay + 1;

  // ALWAYS use 30 days for proration calculation
  const proratedAmount = (monthlyPayment / 30) * daysInPeriod;

  return {
    periodStart,
    periodEnd,
    daysInPeriod,
    totalDaysInMonth: 30, // Always 30 for consistency
    proratedAmount: Math.round(proratedAmount * 100) / 100 // Round to 2 decimals
  };
}

/**
 * Calculate proration for last month invoice
 * Invoice is generated on the 1st of the month following the payoff date
 * and covers the period from start of payoff month to the payoff date
 *
 * IMPORTANT: Always uses 30-day months for proration calculations
 *
 * @param {Date} payoffDate - The payoff date
 * @param {number} monthlyPayment - The full monthly payment amount
 * @returns {Object} Proration details or null if not applicable
 */
function calculateLastMonthProration(payoffDate, monthlyPayment) {
  if (!payoffDate || !monthlyPayment) return null;

  const payoff = new Date(payoffDate);
  const payoffYear = payoff.getFullYear();
  const payoffMonth = payoff.getMonth();
  const payoffDay = payoff.getDate();

  const daysInPayoffMonth = getDaysInMonth(payoffYear, payoffMonth);
  const periodStart = new Date(payoffYear, payoffMonth, 1);
  const periodEnd = new Date(payoffYear, payoffMonth, payoffDay);

  // Calculate days in period (inclusive)
  const daysInPeriod = payoffDay;

  // ALWAYS use 30 days for proration calculation
  const proratedAmount = (monthlyPayment / 30) * daysInPeriod;

  return {
    periodStart,
    periodEnd,
    daysInPeriod,
    totalDaysInMonth: 30, // Always 30 for consistency
    proratedAmount: Math.round(proratedAmount * 100) / 100 // Round to 2 decimals
  };
}

/**
 * Determine if this invoice should have proration and what type
 * @param {Object} loan - The loan record
 * @param {Date} invoiceDate - The invoice date (1st of current month)
 * @param {string} fundDateField - Name of the fund date field
 * @param {string} payoffDateField - Name of the payoff date field (optional)
 * @returns {Object} Proration information
 */
function determineProration(loan, invoiceDate, fundDateField, payoffDateField = null) {
  const invoice = new Date(invoiceDate);
  const invoiceYear = invoice.getFullYear();
  const invoiceMonth = invoice.getMonth();

  // The invoice covers the PREVIOUS month (invoices are in arrears)
  const coveredYear = invoiceMonth === 0 ? invoiceYear - 1 : invoiceYear;
  const coveredMonth = invoiceMonth === 0 ? 11 : invoiceMonth - 1;

  const result = {
    isFirstMonth: false,
    isLastMonth: false,
    prorationType: null,
    periodStart: new Date(coveredYear, coveredMonth, 1),
    periodEnd: new Date(coveredYear, coveredMonth, getDaysInMonth(coveredYear, coveredMonth))
  };

  // Check if this is the first month invoice
  const fundDate = loan[fundDateField];
  if (fundDate && !loan.firstInvoiceGeneratedAt) {
    const fund = new Date(fundDate);
    const fundYear = fund.getFullYear();
    const fundMonth = fund.getMonth();

    // Calculate the first invoice month (month after fund date)
    const firstInvoiceYear = fundMonth === 11 ? fundYear + 1 : fundYear;
    const firstInvoiceMonth = fundMonth === 11 ? 0 : fundMonth + 1;

    // Is this invoice covering the month after the fund date?
    const isFirstInvoiceAfterFunding = (
      invoiceYear === firstInvoiceYear &&
      invoiceMonth === firstInvoiceMonth
    );

    // If yes, check if the fund date is in the month we're covering (for proration)
    if (isFirstInvoiceAfterFunding && fundYear === coveredYear && fundMonth === coveredMonth) {
      result.isFirstMonth = true;
      result.prorationType = 'first_month';
      result.periodStart = fund;
    }
  }

  // Check if this is the last month invoice (only if payoff field exists)
  if (payoffDateField) {
    const payoffDate = loan[payoffDateField];
    if (payoffDate) {
      const payoff = new Date(payoffDate);
      const payoffYear = payoff.getFullYear();
      const payoffMonth = payoff.getMonth();

      // Is the payoff date in the month we're covering?
      if (payoffYear === coveredYear && payoffMonth === coveredMonth) {
        result.isLastMonth = true;
        result.prorationType = 'last_month';
        result.periodEnd = payoff;
      }
    }
  }

  return result;
}

/**
 * Get all users by business name and role (returns full user objects)
 */
async function getUserEmails(businessName, role) {
  try {
    // Map invoice roles to user roles
    const roleMap = {
      'client': ['client', 'borrower'],
      'investor': ['promissory'],
      'capinvestor': ['capinvestor']
    };

    const userRoles = roleMap[role] || [role];

    // Find ALL users with matching business name and role
    const users = await db.User.findAll({
      where: {
        businessName: businessName,
        role: {
          [db.Sequelize.Op.in]: userRoles
        },
        isActive: true,
        email: { [db.Sequelize.Op.ne]: null } // Only users with emails
      },
      attributes: ['email', 'firstName', 'lastName', 'businessName', 'role']
    });

    // Return full user objects
    return users;
  } catch (error) {
    console.error(`Error fetching emails for ${businessName}:`, error.message);
    return [];
  }
}

/**
 * Generate file name for invoice PDF
 */
function generateFileName(businessName, invoiceDate) {
  const cleanName = businessName.replace(/[\s\/\\]/g, '_');
  const dateStr = invoiceDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).replace(/,/g, '').replace(/\s+/g, '_');
  return `${cleanName}_${dateStr}.pdf`;
}

/**
 * Generate S3 key (path) for the invoice
 */
function generateS3Key(role, businessName, fileName) {
  const folderMap = {
    'client': 'clients',
    'investor': 'investors',
    'capinvestor': 'capinvestors'
  };
  const folder = folderMap[role] || role;
  const cleanBusinessName = businessName.replace(/[\s\/\\]/g, '_');
  return `invoices/${folder}/${cleanBusinessName}/${fileName}`;
}

/**
 * Upload PDF to S3
 */
async function uploadToS3(pdfBuffer, s3Key) {
  const params = {
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    ServerSideEncryption: 'AES256'
  };

  await s3.putObject(params).promise();
  return `https://${S3_BUCKET}.s3.amazonaws.com/${s3Key}`;
}

/**
 * Generate HTML for invoice
 */
function generateInvoiceHTML(businessName, role, records, invoiceDate, logoBase64) {
  // Calculate totals
  let totalInvested = 0;
  let monthlyInterest = 0;
  let totalInterestDue = 0;
  let yearToDate = 0;

  if (role === 'client') {
    totalInterestDue = records.reduce((sum, r) => sum + (parseFloat(r.interestPayment) || 0), 0);
  } else if (role === 'investor') {
    totalInvested = records.reduce((sum, r) => sum + (parseFloat(r.loanAmount) || 0), 0);
    monthlyInterest = records.reduce((sum, r) => sum + (parseFloat(r.capitalPay) || 0), 0);
    // Sum up all year-to-date values from all loan records for this investor
    yearToDate = records.reduce((sum, r) => sum + (parseFloat(r.yearToDate) || 0), 0);
  } else if (role === 'capinvestor') {
    totalInvested = records.reduce((sum, r) => sum + (parseFloat(r.loanAmount) || 0), 0);
    monthlyInterest = records.reduce((sum, r) => sum + (parseFloat(r.payment) || 0), 0);
    // Year-to-date is already aggregated per investor, just take first record's value
    yearToDate = records.length > 0 ? (parseFloat(records[0].yearToDate) || 0) : 0;
  }

  // Format currency
  const formatCurrency = (val) => `$${parseFloat(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPercent = (val) => `${parseFloat(val || 0).toFixed(2)}%`;
  const formatDate = (val) => {
    if (!val) return 'N/A';
    const date = new Date(val);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  // Don't manually split records - let browser handle page breaks naturally
  // Put all records in a single container and CSS will handle pagination
  const pages = [records];

  const formattedDate = invoiceDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // Generate table columns based on role
  let tableHeaders = '';
  let tableRows = (pageRecords) => '';

  if (role === 'capinvestor') {
    tableHeaders = `
      <th>Property Address</th>
      <th>Loan Amount</th>
      <th>Date Funded</th>
      <th>Interest Rate</th>
      <th>Interest Earned</th>
    `;
    tableRows = (pageRecords) => pageRecords.map((record, idx) => `
      <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td>${record.propertyAddress || 'No Address'}</td>
        <td>${formatCurrency(record.loanAmount)}</td>
        <td>${formatDate(record.fundDate)}</td>
        <td>${formatPercent(record.interestRate)}</td>
        <td>
          ${formatCurrency(record.payment)}
          ${record.isProrated && record.daysInPeriod ? `<div class="proration-note">Prorated ${record.daysInPeriod} out of 30 days</div>` : ''}
        </td>
      </tr>
    `).join('');
  } else if (role === 'investor') {
    tableHeaders = `
      <th>Date Funded</th>
      <th>Loan Amount</th>
      <th>Interest Rate</th>
      <th>Interest Earned</th>
    `;
    tableRows = (pageRecords) => pageRecords.map((record, idx) => `
      <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td>${formatDate(record.fundDate)}</td>
        <td>${formatCurrency(record.loanAmount)}</td>
        <td>${formatPercent(record.interestRate)}</td>
        <td>
          ${formatCurrency(record.capitalPay)}
          ${record.isProrated && record.daysInPeriod ? `<div class="proration-note">Prorated ${record.daysInPeriod} out of 30 days</div>` : ''}
        </td>
      </tr>
    `).join('');
  } else {
    tableHeaders = `
      <th>Property Address</th>
      <th>Loan Amount</th>
      <th>Interest Rate</th>
      <th>Interest Payment</th>
    `;
    tableRows = (pageRecords) => pageRecords.map((record, idx) => `
      <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td>${record.projectAddress || 'No Address'}</td>
        <td>${formatCurrency(record.loanAmount)}</td>
        <td>${formatPercent(record.interestRate)}</td>
        <td>
          ${formatCurrency(record.interestPayment)}
          ${record.isProrated && record.daysInPeriod ? `<div class="proration-note">Prorated ${record.daysInPeriod} out of 30 days</div>` : ''}
        </td>
      </tr>
    `).join('');
  }

  // Generate HTML with all pages
  const pagesHTML = pages.map((pageRecords, pageIndex) => `
    <div class="invoice-page ${pageIndex > 0 ? 'invoice-page-continuation' : ''}">
      ${pageIndex === 0 ? `
        <!-- Header (only on first page) -->
        <div class="invoice-header-premium">
          <div class="invoice-logo-container">
            ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Coastal Private Lending" class="invoice-logo-image" />` : ''}
            <div class="statement-title">Loan Invoice</div>
          </div>
          <div class="invoice-date-box">
            <div class="date-label">Date</div>
            <div class="date-value">${formattedDate}</div>
          </div>
        </div>

        <!-- Bill To and Account Summary -->
        <div class="invoice-two-column">
          <div class="invoice-section">
            <div class="section-title">BILL TO</div>
            <div class="bill-to-content">${businessName}</div>
          </div>

          <div class="invoice-section account-summary-simple">
            <div class="section-title">ACCOUNT SUMMARY</div>
            ${role === 'client' ? `
              <div class="summary-simple-row">
                <span class="summary-simple-label">Total Interest Due</span>
                <span class="summary-simple-value">${formatCurrency(totalInterestDue)}</span>
              </div>
            ` : `
              <div class="summary-simple-row">
                <span class="summary-simple-label">Total Amount Invested</span>
                <span class="summary-simple-value">${formatCurrency(totalInvested)}</span>
              </div>
              <div class="summary-simple-row">
                <span class="summary-simple-label">Monthly Interest Earned</span>
                <span class="summary-simple-value">${formatCurrency(monthlyInterest)}</span>
              </div>
            `}
          </div>
        </div>
      ` : ''}

      <!-- Description Table -->
      <div class="invoice-table">
        ${pageIndex === 0 ? '<div class="table-header">Description</div>' : ''}
        <table>
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
            ${tableRows(pageRecords)}
          </tbody>
        </table>
      </div>

      ${pageIndex === pages.length - 1 ? `
        <!-- Total (only on last page) -->
        <div class="invoice-total-premium">
          <div class="total-bar">
            ${role === 'client' ? `
              <span class="total-label-premium">Total Due ${formattedDate}</span>
              <span class="total-value-premium">${formatCurrency(totalInterestDue)}</span>
            ` : `
              <span class="total-label-premium">Total Interest Earned (${formattedDate})</span>
              <span class="total-value-premium">${formatCurrency(monthlyInterest)}</span>
            `}
          </div>
          ${role !== 'client' && yearToDate > 0 ? `
          <div class="total-bar year-to-date-bar">
            <span class="total-label-premium">Year to Date Interest Earned</span>
            <span class="total-value-premium">${formatCurrency(yearToDate)}</span>
          </div>
          ` : ''}
        </div>

        <!-- Footer (only on last page) -->
        <div class="invoice-footer-premium">
          <div class="footer-content">
            <p class="footer-thank-you">Thank you for your continued partnership.</p>
            <div class="footer-contact">
              <span class="footer-company">Coastal Private Lending</span>
              <span class="footer-separator">|</span>
              <span class="footer-email">ashley@coastalprivatelending.com</span>
              <span class="footer-separator">|</span>
              <span class="footer-phone">(410) 369-6337</span>
            </div>
            <div class="footer-address">
              <p>30 E. Padonia Rd., Suite 206 • Timonium, MD 21093</p>
              <p><a href="http://www.CoastalPrivateLending.com">www.CoastalPrivateLending.com</a></p>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `).join('');

  // Read CSS from frontend
  const cssPath = path.join(__dirname, '../../../frontend/src/styles/Dashboard.css');
  let css = '';
  try {
    css = require('fs').readFileSync(cssPath, 'utf8');
    console.log(`Loaded CSS (${css.length} characters)`);
  } catch (err) {
    console.error('Could not load Dashboard.css:', err.message);
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${businessName}</title>
  <style>
    ${css}

    /* Force print styles to apply in Puppeteer */
    @page {
      size: 8.5in 11in;
      margin: 0.75in 0;
    }

    @page :first {
      margin: 0 0 0.75in 0;  /* top right bottom left - only bottom margin for page 1 */
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    body {
      margin: 0;
      padding: 0;
      width: 8.5in;
    }

    /* Apply print styles directly (not just in @media print) */
    .invoice-page {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border: none !important;
      background: white !important;
      page-break-after: always !important;
      display: block !important;
      position: relative !important;
    }

    .invoice-page:last-of-type {
      page-break-after: auto !important;
    }

    .invoice-header-premium {
      background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%) !important;
      margin: 0 !important;
      padding: 48px 0.75in !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .invoice-two-column {
      page-break-inside: auto;
      padding: 0 0.75in !important;
      margin: 16px 0 !important;
    }

    .invoice-table {
      page-break-inside: auto;
      padding: 16px 0.75in !important;
      margin: 0 !important;
    }

    .invoice-table table {
      border-collapse: collapse;
      page-break-inside: auto;
      width: 100%;
    }

    .invoice-table thead {
      background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%) !important;
      display: table-header-group;
    }

    .invoice-table thead th {
      background: transparent !important;
      color: white !important;
    }

    .invoice-table tbody {
      display: table-row-group;
    }

    .invoice-table tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }

    .invoice-total-premium {
      page-break-inside: auto;
      padding: 0 0.75in !important;
      margin: 16px 0 !important;
    }

    .invoice-footer-premium {
      page-break-inside: auto;
      padding: 0 0.75in 0.75in 0.75in !important;
    }
  </style>
</head>
<body>
  ${pagesHTML}
</body>
</html>
  `;
}

/**
 * Process invoice for a single business (client/borrower)
 */
async function processBusiness(browser, businessName, invoiceDate, logoBase64) {
  try {
    console.log(`Processing business: ${businessName}`);

    // Calculate the period we're covering (invoices are in arrears)
    const invoice = new Date(invoiceDate);
    const invoiceMonth = invoice.getMonth();
    const invoiceYear = invoice.getFullYear();
    const coveredYear = invoiceMonth === 0 ? invoiceYear - 1 : invoiceYear;
    const coveredMonth = invoiceMonth === 0 ? 11 : invoiceMonth - 1;
    const periodStart = new Date(coveredYear, coveredMonth, 1);

    // Get records from funded table (Funded doesn't have payoff date, so no exclusion filter needed)
    const allRecords = await db.Funded.findAll({
      where: { businessName: businessName }
    });

    // Filter out loans where closingDate is in the same month+year as invoice date
    // These loans should appear in NEXT month's invoice, not this one
    // Use UTC to ensure consistent timezone handling
    const records = allRecords.filter(record => {
      if (!record.closingDate) return true; // Include if no closing date

      const closingDate = new Date(record.closingDate);
      const closingYear = closingDate.getUTCFullYear();
      const closingMonth = closingDate.getUTCMonth();

      // Exclude if closing date is in the same month+year as invoice date
      const shouldExclude = (closingYear === invoiceYear && closingMonth === invoiceMonth);

      if (shouldExclude) {
        console.log(`  → Excluding ${record.projectAddress}: closed in ${closingMonth + 1}/${closingYear}, will appear in next month's invoice`);
      }

      return !shouldExclude;
    });

    if (records.length === 0) {
      console.warn(`No records found for business: ${businessName}`);
      return { success: false, reason: 'no_records' };
    }

    // Process each record and apply proration logic
    const processedRecords = [];
    const lineItems = [];

    for (const record of records) {
      const proration = determineProration(record, invoiceDate, 'closingDate', null);

      let finalAmount = parseFloat(record.interestPayment) || 0;
      let isProrated = false;
      let prorationType = null;
      let daysInPeriod = getDaysInMonth(coveredYear, coveredMonth);
      let totalDaysInMonth = daysInPeriod;

      // Apply first month proration if applicable
      if (proration.isFirstMonth) {
        const prorationCalc = calculateFirstMonthProration(record.closingDate, finalAmount);
        if (prorationCalc) {
          finalAmount = prorationCalc.proratedAmount;
          isProrated = true;
          prorationType = 'first_month';
          daysInPeriod = prorationCalc.daysInPeriod;
          totalDaysInMonth = prorationCalc.totalDaysInMonth;
          console.log(`  → First month proration for ${record.projectAddress}: $${finalAmount} (${daysInPeriod}/${totalDaysInMonth} days)`);
        }
      }

      // Add to processed records for invoice display
      processedRecords.push({
        ...record.toJSON(),
        interestPayment: finalAmount,
        isProrated,
        prorationType,
        daysInPeriod
      });

      // Prepare line item data
      lineItems.push({
        loanTable: 'funded',
        loanId: record.id,
        loanIdentifier: `${record.businessName} - ${record.projectAddress}`,
        originalAmount: parseFloat(record.interestPayment) || 0,
        proratedAmount: finalAmount,
        isProrated,
        prorationType,
        periodStartDate: proration.periodStart,
        periodEndDate: proration.periodEnd,
        daysInPeriod,
        totalDaysInMonth
      });
    }

    // Generate HTML with processed records
    const html = generateInvoiceHTML(businessName, 'client', processedRecords, invoiceDate, logoBase64);

    // Generate PDF using Puppeteer
    const page = await browser.newPage();
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Set viewport to match Letter size at 96 DPI
    await page.setViewport({
      width: 816,  // 8.5 inches * 96 DPI
      height: 1056, // 11 inches * 96 DPI
      deviceScaleFactor: 1
    });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      scale: 0.85  // 15% scale down to match browser print rendering
    });
    await page.close();

    // Generate file name and S3 key
    const fileName = generateFileName(businessName, invoiceDate);
    const s3Key = generateS3Key('client', businessName, fileName);

    // Upload to S3
    const s3Url = await uploadToS3(pdfBuffer, s3Key);

    // Calculate total from processed records
    const totalAmount = processedRecords.reduce((sum, r) => sum + (parseFloat(r.interestPayment) || 0), 0);

    // Save to database
    // Format date as YYYY-MM-DD without timezone conversion
    const year = invoiceDate.getFullYear();
    const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');
    const day = String(invoiceDate.getDate()).padStart(2, '0');
    const invoiceDateStr = `${year}-${month}-${day}`;

    const [invoiceResult, created] = await db.Invoice.upsert({
      businessName: businessName,
      role: 'client',
      invoiceDate: invoiceDateStr,
      fileName: fileName,
      s3Key: s3Key,
      s3Url: s3Url,
      totalAmount: totalAmount,
      recordCount: processedRecords.length
    }, {
      returning: true
    });

    // Get the actual invoice ID (upsert returns array with instance and created flag)
    const invoiceRecord = Array.isArray(invoiceResult) ? invoiceResult[0] : invoiceResult;
    const invoiceId = invoiceRecord.id;

    // Delete existing line items for this invoice (in case of regeneration)
    await db.InvoiceLineItem.destroy({
      where: { invoiceId: invoiceId }
    });

    // Create line items
    for (const lineItem of lineItems) {
      await db.InvoiceLineItem.create({
        invoiceId: invoiceId,
        ...lineItem
      });
    }

    // Update first_invoice_generated_at for records that had first month proration
    for (const record of records) {
      const proration = determineProration(record, invoiceDate, 'closingDate', null);
      if (proration.isFirstMonth && !record.firstInvoiceGeneratedAt) {
        await db.Funded.update(
          { firstInvoiceGeneratedAt: new Date() },
          { where: { id: record.id } }
        );
      }
    }

    console.log(`✓ Successfully processed ${businessName}: ${records.length} records, $${totalAmount.toFixed(2)}`);

    // Send email to ALL users with this business name
    const users = await getUserEmails(businessName, 'client');
    const successfulRecipients = [];

    if (users.length > 0) {
      console.log(`  → Sending invoice emails to ${users.length} recipient(s)...`);

      let emailsSent = 0;
      let emailsFailed = 0;
      const allRecipients = [];

      for (const user of users) {
        console.log(`     • ${user.email}...`);
        const emailResult = await sendInvoiceEmail(
          user.email,
          businessName,
          'client',
          pdfBuffer,
          fileName,
          invoiceDate,
          totalAmount
        );

        if (emailResult.success) {
          emailsSent++;
          allRecipients.push(user.email);
          successfulRecipients.push({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            businessName: user.businessName,
            role: user.role
          });
          console.log(`     ✓ Sent successfully`);
        } else {
          emailsFailed++;
          console.log(`     ✗ Failed: ${emailResult.error}`);
        }
      }

      // Update invoice record with email status
      await db.Invoice.update({
        emailSent: emailsSent > 0,
        emailSentAt: emailsSent > 0 ? new Date() : null,
        emailRecipient: allRecipients.join(', '),
        emailError: emailsFailed > 0 ? `${emailsFailed} failed` : null
      }, {
        where: {
          businessName: businessName,
          role: 'client',
          invoiceDate: invoiceDateStr
        }
      });

      console.log(`  ✓ Sent to ${emailsSent}/${users.length} recipients`);
    } else {
      console.log(`  ⚠ No email found for ${businessName}`);
    }

    return { success: true, emailSent: users.length > 0, recipients: successfulRecipients };
  } catch (error) {
    console.error(`✗ Failed to process business ${businessName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Process invoice for a single investor (promissory)
 */
async function processInvestor(browser, investorName, invoiceDate, logoBase64) {
  try {
    console.log(`Processing investor: ${investorName}`);

    // Calculate the period we're covering (invoices are in arrears)
    const invoice = new Date(invoiceDate);
    const invoiceMonth = invoice.getMonth();
    const invoiceYear = invoice.getFullYear();
    const coveredYear = invoiceMonth === 0 ? invoiceYear - 1 : invoiceYear;
    const coveredMonth = invoiceMonth === 0 ? 11 : invoiceMonth - 1;
    const periodStart = new Date(coveredYear, coveredMonth, 1);

    // Get active records from promissory table
    // Include loans with payoff_date >= period start (to include final prorated invoice)
    const allRecords = await db.Promissory.findAll({
      where: {
        investorName: investorName,
        [db.Sequelize.Op.or]: [
          { status: null },
          { status: { [db.Sequelize.Op.notILike]: 'closed' } }
        ],
        [db.Sequelize.Op.or]: [
          { payoffDate: null },
          { payoffDate: { [db.Sequelize.Op.gte]: periodStart } }
        ]
      }
    });

    // Filter out loans where fundDate is in the same month+year as invoice date
    // These loans should appear in NEXT month's invoice, not this one
    // Use UTC to ensure consistent timezone handling
    const records = allRecords.filter(record => {
      if (!record.fundDate) return true; // Include if no fund date

      const fundDate = new Date(record.fundDate);
      const fundYear = fundDate.getUTCFullYear();
      const fundMonth = fundDate.getUTCMonth();

      // Exclude if fund date is in the same month+year as invoice date
      const shouldExclude = (fundYear === invoiceYear && fundMonth === invoiceMonth);

      if (shouldExclude) {
        console.log(`  → Excluding ${record.assetId || record.investorName}: funded in ${fundMonth + 1}/${fundYear}, will appear in next month's invoice`);
      }

      return !shouldExclude;
    });

    if (records.length === 0) {
      console.warn(`No active records found for investor: ${investorName}`);
      return { success: false, reason: 'no_records' };
    }

    // Process each record and apply proration logic
    const processedRecords = [];
    const lineItems = [];

    for (const record of records) {
      const proration = determineProration(record, invoiceDate, 'fundDate', 'payoffDate');

      let finalAmount = parseFloat(record.capitalPay) || 0;
      let isProrated = false;
      let prorationType = null;
      let daysInPeriod = getDaysInMonth(coveredYear, coveredMonth);
      let totalDaysInMonth = daysInPeriod;

      // Apply first month proration if applicable
      if (proration.isFirstMonth) {
        const prorationCalc = calculateFirstMonthProration(record.fundDate, finalAmount);
        if (prorationCalc) {
          finalAmount = prorationCalc.proratedAmount;
          isProrated = true;
          prorationType = 'first_month';
          daysInPeriod = prorationCalc.daysInPeriod;
          totalDaysInMonth = prorationCalc.totalDaysInMonth;
          console.log(`  → First month proration for ${record.assetId || record.investorName}: $${finalAmount} (${daysInPeriod}/${totalDaysInMonth} days)`);
        }
      }

      // Apply last month proration if applicable
      if (proration.isLastMonth) {
        const prorationCalc = calculateLastMonthProration(record.payoffDate, parseFloat(record.capitalPay) || 0);
        if (prorationCalc) {
          finalAmount = prorationCalc.proratedAmount;
          isProrated = true;
          prorationType = 'last_month';
          daysInPeriod = prorationCalc.daysInPeriod;
          totalDaysInMonth = prorationCalc.totalDaysInMonth;
          console.log(`  → Last month proration for ${record.assetId || record.investorName}: $${finalAmount} (${daysInPeriod}/${totalDaysInMonth} days)`);
        }
      }

      // Add to processed records for invoice display
      processedRecords.push({
        ...record.toJSON(),
        capitalPay: finalAmount,
        isProrated,
        prorationType,
        daysInPeriod
      });

      // Prepare line item data
      lineItems.push({
        loanTable: 'promissory',
        loanId: record.id,
        loanIdentifier: `${record.assetId || 'Unknown'} - ${record.investorName}`,
        originalAmount: parseFloat(record.capitalPay) || 0,
        proratedAmount: finalAmount,
        isProrated,
        prorationType,
        periodStartDate: proration.periodStart,
        periodEndDate: proration.periodEnd,
        daysInPeriod,
        totalDaysInMonth
      });
    }

    // Generate HTML with processed records
    const html = generateInvoiceHTML(investorName, 'investor', processedRecords, invoiceDate, logoBase64);

    // Generate PDF using Puppeteer
    const page = await browser.newPage();
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Set viewport to match Letter size at 96 DPI
    await page.setViewport({
      width: 816,  // 8.5 inches * 96 DPI
      height: 1056, // 11 inches * 96 DPI
      deviceScaleFactor: 1
    });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      scale: 0.85  // 15% scale down to match browser print rendering
    });
    await page.close();

    // Generate file name and S3 key
    const fileName = generateFileName(investorName, invoiceDate);
    const s3Key = generateS3Key('investor', investorName, fileName);

    // Upload to S3
    const s3Url = await uploadToS3(pdfBuffer, s3Key);

    // Calculate totals from processed records
    const totalAmount = processedRecords.reduce((sum, r) => sum + (parseFloat(r.loanAmount) || 0), 0);
    const monthlyInterest = processedRecords.reduce((sum, r) => sum + (parseFloat(r.capitalPay) || 0), 0);

    // Save to database
    // Format date as YYYY-MM-DD without timezone conversion
    const year = invoiceDate.getFullYear();
    const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');
    const day = String(invoiceDate.getDate()).padStart(2, '0');
    const invoiceDateStr = `${year}-${month}-${day}`;

    const [invoiceResult, created] = await db.Invoice.upsert({
      businessName: investorName,
      role: 'investor',
      invoiceDate: invoiceDateStr,
      fileName: fileName,
      s3Key: s3Key,
      s3Url: s3Url,
      totalAmount: monthlyInterest,
      recordCount: processedRecords.length
    }, {
      returning: true
    });

    // Get the actual invoice ID (upsert returns array with instance and created flag)
    const invoiceRecord = Array.isArray(invoiceResult) ? invoiceResult[0] : invoiceResult;
    const invoiceId = invoiceRecord.id;

    // Delete existing line items for this invoice (in case of regeneration)
    await db.InvoiceLineItem.destroy({
      where: { invoiceId: invoiceId }
    });

    // Create line items
    for (const lineItem of lineItems) {
      await db.InvoiceLineItem.create({
        invoiceId: invoiceId,
        ...lineItem
      });
    }

    // Update first_invoice_generated_at for records that had first month proration
    for (const record of records) {
      const proration = determineProration(record, invoiceDate, 'fundDate', 'payoffDate');
      if (proration.isFirstMonth && !record.firstInvoiceGeneratedAt) {
        await db.Promissory.update(
          { firstInvoiceGeneratedAt: new Date() },
          { where: { id: record.id } }
        );
      }
    }

    console.log(`✓ Successfully processed ${investorName}: ${records.length} records, $${monthlyInterest.toFixed(2)}/month`);

    // Send email to ALL users with this investor name
    const users = await getUserEmails(investorName, 'investor');
    const successfulRecipients = [];

    if (users.length > 0) {
      console.log(`  → Sending invoice emails to ${users.length} recipient(s)...`);

      let emailsSent = 0;
      let emailsFailed = 0;
      const allRecipients = [];

      for (const user of users) {
        console.log(`     • ${user.email}...`);
        const emailResult = await sendInvoiceEmail(
          user.email,
          investorName,
          'investor',
          pdfBuffer,
          fileName,
          invoiceDate,
          monthlyInterest
        );

        if (emailResult.success) {
          emailsSent++;
          allRecipients.push(user.email);
          successfulRecipients.push({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            businessName: user.businessName,
            role: user.role
          });
          console.log(`     ✓ Sent successfully`);
        } else {
          emailsFailed++;
          console.log(`     ✗ Failed: ${emailResult.error}`);
        }
      }

      // Update invoice record with email status
      await db.Invoice.update({
        emailSent: emailsSent > 0,
        emailSentAt: emailsSent > 0 ? new Date() : null,
        emailRecipient: allRecipients.join(', '),
        emailError: emailsFailed > 0 ? `${emailsFailed} failed` : null
      }, {
        where: {
          businessName: investorName,
          role: 'investor',
          invoiceDate: invoiceDateStr
        }
      });

      console.log(`  ✓ Sent to ${emailsSent}/${users.length} recipients`);
    } else {
      console.log(`  ⚠ No email found for ${investorName}`);
    }

    return { success: true, emailSent: users.length > 0, recipients: successfulRecipients };
  } catch (error) {
    console.error(`✗ Failed to process investor ${investorName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Process invoice for a single cap investor
 */
async function processCapInvestor(browser, investorName, invoiceDate, logoBase64) {
  try {
    console.log(`Processing cap investor: ${investorName}`);

    // Calculate the period we're covering (invoices are in arrears)
    const invoice = new Date(invoiceDate);
    const invoiceMonth = invoice.getMonth();
    const invoiceYear = invoice.getFullYear();
    const coveredYear = invoiceMonth === 0 ? invoiceYear - 1 : invoiceYear;
    const coveredMonth = invoiceMonth === 0 ? 11 : invoiceMonth - 1;
    const periodStart = new Date(coveredYear, coveredMonth, 1);

    // Get funded records from capinvestor table
    // Include loans with payoff_date >= period start (to include final prorated invoice)
    const allRecords = await db.CapInvestor.findAll({
      where: {
        investorName: investorName,
        loanStatus: 'Funded',
        [db.Sequelize.Op.or]: [
          { payoffDate: null },
          { payoffDate: { [db.Sequelize.Op.gte]: periodStart } }
        ]
      }
    });

    // Filter out loans where fundDate is in the same month+year as invoice date
    // These loans should appear in NEXT month's invoice, not this one
    // Use UTC to ensure consistent timezone handling
    const records = allRecords.filter(record => {
      if (!record.fundDate) return true; // Include if no fund date

      const fundDate = new Date(record.fundDate);
      const fundYear = fundDate.getUTCFullYear();
      const fundMonth = fundDate.getUTCMonth();

      // Exclude if fund date is in the same month+year as invoice date
      const shouldExclude = (fundYear === invoiceYear && fundMonth === invoiceMonth);

      if (shouldExclude) {
        console.log(`  → Excluding ${record.propertyAddress}: funded in ${fundMonth + 1}/${fundYear}, will appear in next month's invoice`);
      }

      return !shouldExclude;
    });

    if (records.length === 0) {
      console.warn(`No active records found for cap investor: ${investorName}`);
      return { success: false, reason: 'no_records' };
    }

    // Process each record and apply proration logic
    const processedRecords = [];
    const lineItems = [];

    for (const record of records) {
      const proration = determineProration(record, invoiceDate, 'fundDate', 'payoffDate');

      let finalAmount = parseFloat(record.payment) || 0;
      let isProrated = false;
      let prorationType = null;
      let daysInPeriod = getDaysInMonth(coveredYear, coveredMonth);
      let totalDaysInMonth = daysInPeriod;

      // Apply first month proration if applicable
      if (proration.isFirstMonth) {
        const prorationCalc = calculateFirstMonthProration(record.fundDate, finalAmount);
        if (prorationCalc) {
          finalAmount = prorationCalc.proratedAmount;
          isProrated = true;
          prorationType = 'first_month';
          daysInPeriod = prorationCalc.daysInPeriod;
          totalDaysInMonth = prorationCalc.totalDaysInMonth;
          console.log(`  → First month proration for ${record.propertyAddress}: $${finalAmount} (${daysInPeriod}/${totalDaysInMonth} days)`);
        }
      }

      // Apply last month proration if applicable
      if (proration.isLastMonth) {
        const prorationCalc = calculateLastMonthProration(record.payoffDate, parseFloat(record.payment) || 0);
        if (prorationCalc) {
          finalAmount = prorationCalc.proratedAmount;
          isProrated = true;
          prorationType = 'last_month';
          daysInPeriod = prorationCalc.daysInPeriod;
          totalDaysInMonth = prorationCalc.totalDaysInMonth;
          console.log(`  → Last month proration for ${record.propertyAddress}: $${finalAmount} (${daysInPeriod}/${totalDaysInMonth} days)`);
        }
      }

      // Add to processed records for invoice display
      processedRecords.push({
        ...record.toJSON(),
        payment: finalAmount,
        isProrated,
        prorationType,
        daysInPeriod
      });

      // Prepare line item data
      lineItems.push({
        loanTable: 'capinvestor',
        loanId: record.id,
        loanIdentifier: `${record.propertyAddress} - ${record.investorName}`,
        originalAmount: parseFloat(record.payment) || 0,
        proratedAmount: finalAmount,
        isProrated,
        prorationType,
        periodStartDate: proration.periodStart,
        periodEndDate: proration.periodEnd,
        daysInPeriod,
        totalDaysInMonth
      });
    }

    // Generate HTML with processed records
    const html = generateInvoiceHTML(investorName, 'capinvestor', processedRecords, invoiceDate, logoBase64);

    // Generate PDF using Puppeteer
    const page = await browser.newPage();
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Set viewport to match Letter size at 96 DPI
    await page.setViewport({
      width: 816,  // 8.5 inches * 96 DPI
      height: 1056, // 11 inches * 96 DPI
      deviceScaleFactor: 1
    });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      scale: 0.85  // 15% scale down to match browser print rendering
    });
    await page.close();

    // Generate file name and S3 key
    const fileName = generateFileName(investorName, invoiceDate);
    const s3Key = generateS3Key('capinvestor', investorName, fileName);

    // Upload to S3
    const s3Url = await uploadToS3(pdfBuffer, s3Key);

    // Calculate totals from processed records
    const totalAmount = processedRecords.reduce((sum, r) => sum + (parseFloat(r.loanAmount) || 0), 0);
    const monthlyInterest = processedRecords.reduce((sum, r) => sum + (parseFloat(r.payment) || 0), 0);

    // Save to database
    // Format date as YYYY-MM-DD without timezone conversion
    const year = invoiceDate.getFullYear();
    const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');
    const day = String(invoiceDate.getDate()).padStart(2, '0');
    const invoiceDateStr = `${year}-${month}-${day}`;

    const [invoiceResult, created] = await db.Invoice.upsert({
      businessName: investorName,
      role: 'capinvestor',
      invoiceDate: invoiceDateStr,
      fileName: fileName,
      s3Key: s3Key,
      s3Url: s3Url,
      totalAmount: monthlyInterest,
      recordCount: processedRecords.length
    }, {
      returning: true
    });

    // Get the actual invoice ID (upsert returns array with instance and created flag)
    const invoiceRecord = Array.isArray(invoiceResult) ? invoiceResult[0] : invoiceResult;
    const invoiceId = invoiceRecord.id;

    // Delete existing line items for this invoice (in case of regeneration)
    await db.InvoiceLineItem.destroy({
      where: { invoiceId: invoiceId }
    });

    // Create line items
    for (const lineItem of lineItems) {
      await db.InvoiceLineItem.create({
        invoiceId: invoiceId,
        ...lineItem
      });
    }

    // Update first_invoice_generated_at for records that had first month proration
    for (const record of records) {
      const proration = determineProration(record, invoiceDate, 'fundDate', 'payoffDate');
      if (proration.isFirstMonth && !record.firstInvoiceGeneratedAt) {
        await db.CapInvestor.update(
          { firstInvoiceGeneratedAt: new Date() },
          { where: { id: record.id } }
        );
      }
    }

    console.log(`✓ Successfully processed ${investorName}: ${records.length} records, $${monthlyInterest.toFixed(2)}/month`);

    // Send email to ALL users with this investor name
    const users = await getUserEmails(investorName, 'capinvestor');
    const successfulRecipients = [];

    if (users.length > 0) {
      console.log(`  → Sending invoice emails to ${users.length} recipient(s)...`);

      let emailsSent = 0;
      let emailsFailed = 0;
      const allRecipients = [];

      for (const user of users) {
        console.log(`     • ${user.email}...`);
        const emailResult = await sendInvoiceEmail(
          user.email,
          investorName,
          'capinvestor',
          pdfBuffer,
          fileName,
          invoiceDate,
          monthlyInterest
        );

        if (emailResult.success) {
          emailsSent++;
          allRecipients.push(user.email);
          successfulRecipients.push({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            businessName: user.businessName,
            role: user.role
          });
          console.log(`     ✓ Sent successfully`);
        } else {
          emailsFailed++;
          console.log(`     ✗ Failed: ${emailResult.error}`);
        }
      }

      // Update invoice record with email status
      await db.Invoice.update({
        emailSent: emailsSent > 0,
        emailSentAt: emailsSent > 0 ? new Date() : null,
        emailRecipient: allRecipients.join(', '),
        emailError: emailsFailed > 0 ? `${emailsFailed} failed` : null
      }, {
        where: {
          businessName: investorName,
          role: 'capinvestor',
          invoiceDate: invoiceDateStr
        }
      });

      console.log(`  ✓ Sent to ${emailsSent}/${users.length} recipients`);
    } else {
      console.log(`  ⚠ No email found for ${investorName}`);
    }

    return { success: true, emailSent: users.length > 0, recipients: successfulRecipients };
  } catch (error) {
    console.error(`✗ Failed to process cap investor ${investorName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send summary report email to management
 */
async function sendSummaryReport(allRecipients, invoiceDate) {
  try {
    const { google } = require('googleapis');

    // Create OAuth2 client for Gmail API
    const oauth2Client = new google.auth.OAuth2(
      process.env.EMAIL_CLIENT_ID,
      process.env.EMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.EMAIL_REFRESH_TOKEN
    });

    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Format date
    const formattedDate = invoiceDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    // Categorize recipients by role
    const borrowers = allRecipients.filter(r => r.role === 'client' || r.role === 'borrower');
    const promissory = allRecipients.filter(r => r.role === 'promissory');
    const capInvestors = allRecipients.filter(r => r.role === 'capinvestor');

    // Generate HTML for each category
    const generateTableRows = (recipients) => {
      if (recipients.length === 0) {
        return '<tr><td colspan="3" style="text-align: center; padding: 12px; color: #666;">No invoices sent</td></tr>';
      }
      return recipients.map((r, idx) => `
        <tr style="${idx % 2 === 0 ? 'background-color: #f9fafb;' : ''}">
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${r.businessName}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${r.firstName} ${r.lastName}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${r.email}</td>
        </tr>
      `).join('');
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice Generation Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="800" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Monthly Invoice Report</h1>
              <p style="color: #E0E7FF; margin: 10px 0 0 0; font-size: 16px;">${formattedDate}</p>
            </td>
          </tr>

          <!-- Summary Stats -->
          <tr>
            <td style="padding: 30px;">
              <div style="display: flex; justify-content: space-around; text-align: center; margin-bottom: 30px;">
                <div style="flex: 1; padding: 20px; background-color: #f0f9ff; border-radius: 8px; margin: 0 5px;">
                  <div style="font-size: 32px; font-weight: bold; color: #1e40af;">${borrowers.length}</div>
                  <div style="font-size: 14px; color: #64748b; text-transform: uppercase; margin-top: 8px;">Clients</div>
                </div>
                <div style="flex: 1; padding: 20px; background-color: #f0fdf4; border-radius: 8px; margin: 0 5px;">
                  <div style="font-size: 32px; font-weight: bold; color: #15803d;">${promissory.length}</div>
                  <div style="font-size: 14px; color: #64748b; text-transform: uppercase; margin-top: 8px;">Promissory</div>
                </div>
                <div style="flex: 1; padding: 20px; background-color: #fef3c7; border-radius: 8px; margin: 0 5px;">
                  <div style="font-size: 32px; font-weight: bold; color: #92400e;">${capInvestors.length}</div>
                  <div style="font-size: 14px; color: #64748b; text-transform: uppercase; margin-top: 8px;">Cap Investors</div>
                </div>
              </div>

              <!-- Borrowers/Clients -->
              <h2 style="color: #1e40af; font-size: 20px; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #2563EB;">
                Clients / Borrowers (${borrowers.length})
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                  <tr style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);">
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600;">Business Name</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600;">Name</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600;">Email</th>
                  </tr>
                </thead>
                <tbody>
                  ${generateTableRows(borrowers)}
                </tbody>
              </table>

              <!-- Promissory Investors -->
              <h2 style="color: #15803d; font-size: 20px; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #22c55e;">
                Promissory Investors (${promissory.length})
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                  <tr style="background: linear-gradient(135deg, #15803d 0%, #22c55e 100%);">
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600;">Investor Name</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600;">Name</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600;">Email</th>
                  </tr>
                </thead>
                <tbody>
                  ${generateTableRows(promissory)}
                </tbody>
              </table>

              <!-- Cap Investors -->
              <h2 style="color: #92400e; font-size: 20px; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #f59e0b;">
                Cap Investors (${capInvestors.length})
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                  <tr style="background: linear-gradient(135deg, #92400e 0%, #f59e0b 100%);">
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600;">Investor Name</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600;">Name</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600;">Email</th>
                  </tr>
                </thead>
                <tbody>
                  ${generateTableRows(capInvestors)}
                </tbody>
              </table>

              <!-- Total -->
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; margin-top: 30px;">
                <p style="margin: 0; font-size: 18px; color: #1e293b;">
                  <strong>Total Invoices Sent:</strong> <span style="color: #2563EB; font-size: 24px; font-weight: bold;">${allRecipients.length}</span>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #64748b; font-size: 14px; margin: 0;">
                This is an automated report from the Coastal Private Lending invoice generation system.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Get management emails from database settings
    let managementEmails = [];
    try {
      const setting = await db.AppSettings.findOne({
        where: { settingKey: 'invoice_summary_emails' }
      });

      if (setting && setting.settingValue) {
        // Split comma-separated emails and trim whitespace
        managementEmails = setting.settingValue
          .split(',')
          .map(email => email.trim())
          .filter(email => email.length > 0);
      }

      // Fallback to default emails if no setting found
      if (managementEmails.length === 0) {
        managementEmails = [
          'todd@coastalprivatelending.com',
          'ashley@coastalprivatelending.com',
          'benjamin.frankstein@gmail.com'
        ];
      }
    } catch (error) {
      console.error('Failed to load summary email settings, using defaults:', error.message);
      // Fallback to default emails on error
      managementEmails = [
        'todd@coastalprivatelending.com',
        'ashley@coastalprivatelending.com',
        'benjamin.frankstein@gmail.com'
      ];
    }

    // Create MIME message
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const messageParts = [];

    messageParts.push(`To: ${managementEmails.join(', ')}`);
    messageParts.push(`From: ${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_USER}>`);
    messageParts.push(`Subject: Invoice Generation Report - ${formattedDate}`);
    messageParts.push('MIME-Version: 1.0');
    messageParts.push(`Content-Type: text/html; charset=UTF-8`);
    messageParts.push('');
    messageParts.push(html);

    const mimeMessage = messageParts.join('\r\n');

    // Encode and send via Gmail API
    const encodedMessage = Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log('\n✓ Summary report sent to management');
  } catch (error) {
    console.error('✗ Failed to send summary report:', error.message);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Starting Monthly Invoice Generation');
  console.log('='.repeat(80));

  // Validate environment variables
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('Missing required environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
    process.exit(1);
  }

  // Use first of current month as invoice date (Eastern Time)
  // Get current date in Eastern timezone
  const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const dateET = new Date(nowET);

  // Create invoice date as 1st of current month in Eastern Time
  const year = dateET.getFullYear();
  const month = dateET.getMonth();
  const invoiceDate = new Date(year, month, 1, 0, 0, 0, 0);

  console.log(`Invoice Date: ${invoiceDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`);

  // Load logo
  console.log('Loading logo...');
  let logoBase64 = null;
  try {
    const logoPath = path.join(__dirname, '../../../frontend/src/assets/coastal-logo.png');
    const logoBuffer = await fs.readFile(logoPath);
    logoBase64 = logoBuffer.toString('base64');
    console.log('Logo loaded successfully');
  } catch (error) {
    console.warn('Could not load logo:', error.message);
  }

  // Launch Puppeteer
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
  });

  // Statistics
  const stats = {
    clients: { processed: 0, failed: 0, emailsSent: 0, emailsFailed: 0, noEmail: 0 },
    investors: { processed: 0, failed: 0, emailsSent: 0, emailsFailed: 0, noEmail: 0 },
    capinvestors: { processed: 0, failed: 0, emailsSent: 0, emailsFailed: 0, noEmail: 0 }
  };

  // Track all successful email recipients for summary report
  const allRecipients = [];

  try {
    // Process all businesses (clients/borrowers)
    console.log('\n' + '='.repeat(80));
    console.log('Processing Businesses (Clients/Borrowers)');
    console.log('='.repeat(80));

    const businesses = await db.Funded.findAll({
      attributes: [[db.Sequelize.fn('DISTINCT', db.Sequelize.col('business_name')), 'business_name']],
      raw: true
    });
    console.log(`Found ${businesses.length} businesses`);

    for (const business of businesses) {
      const result = await processBusiness(browser, business.business_name, invoiceDate, logoBase64);
      if (result.success) {
        stats.clients.processed++;
        if (result.emailSent === true) {
          stats.clients.emailsSent++;
        } else if (result.emailSent === false) {
          stats.clients.noEmail++;
        }
        // Collect recipients for summary report
        if (result.recipients && result.recipients.length > 0) {
          allRecipients.push(...result.recipients);
        }
      } else {
        stats.clients.failed++;
      }
    }

    // Process all investors (promissory)
    console.log('\n' + '='.repeat(80));
    console.log('Processing Investors (Promissory)');
    console.log('='.repeat(80));

    const investors = await db.Promissory.findAll({
      attributes: [[db.Sequelize.fn('DISTINCT', db.Sequelize.col('investor_name')), 'investor_name']],
      where: {
        investorName: { [db.Sequelize.Op.ne]: null },
        [db.Sequelize.Op.or]: [
          { status: null },
          { status: { [db.Sequelize.Op.notILike]: 'closed' } }
        ]
      },
      raw: true
    });
    console.log(`Found ${investors.length} investors`);

    for (const investor of investors) {
      const result = await processInvestor(browser, investor.investor_name, invoiceDate, logoBase64);
      if (result.success) {
        stats.investors.processed++;
        if (result.emailSent === true) {
          stats.investors.emailsSent++;
        } else if (result.emailSent === false) {
          stats.investors.noEmail++;
        }
        // Collect recipients for summary report
        if (result.recipients && result.recipients.length > 0) {
          allRecipients.push(...result.recipients);
        }
      } else {
        stats.investors.failed++;
      }
    }

    // Process all cap investors
    console.log('\n' + '='.repeat(80));
    console.log('Processing Cap Investors');
    console.log('='.repeat(80));

    const capInvestors = await db.CapInvestor.findAll({
      attributes: [[db.Sequelize.fn('DISTINCT', db.Sequelize.col('investor_name')), 'investor_name']],
      where: {
        investorName: { [db.Sequelize.Op.ne]: null },
        loanStatus: 'Funded'
      },
      raw: true
    });
    console.log(`Found ${capInvestors.length} cap investors`);

    for (const capInvestor of capInvestors) {
      const result = await processCapInvestor(browser, capInvestor.investor_name, invoiceDate, logoBase64);
      if (result.success) {
        stats.capinvestors.processed++;
        if (result.emailSent === true) {
          stats.capinvestors.emailsSent++;
        } else if (result.emailSent === false) {
          stats.capinvestors.noEmail++;
        }
        // Collect recipients for summary report
        if (result.recipients && result.recipients.length > 0) {
          allRecipients.push(...result.recipients);
        }
      } else {
        stats.capinvestors.failed++;
      }
    }

  } finally {
    await browser.close();
  }

  // Send summary report to management
  if (allRecipients.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('Sending Summary Report to Management');
    console.log('='.repeat(80));
    await sendSummaryReport(allRecipients, invoiceDate);
  } else {
    console.log('\n⚠ No invoices were sent, skipping summary report');
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('Invoice Generation Complete');
  console.log('='.repeat(80));
  console.log(`Clients:       ${stats.clients.processed} processed, ${stats.clients.failed} failed`);
  console.log(`               ${stats.clients.emailsSent} emails sent, ${stats.clients.noEmail} no email found`);
  console.log(`Investors:     ${stats.investors.processed} processed, ${stats.investors.failed} failed`);
  console.log(`               ${stats.investors.emailsSent} emails sent, ${stats.investors.noEmail} no email found`);
  console.log(`Cap Investors: ${stats.capinvestors.processed} processed, ${stats.capinvestors.failed} failed`);
  console.log(`               ${stats.capinvestors.emailsSent} emails sent, ${stats.capinvestors.noEmail} no email found`);
  console.log('='.repeat(80));

  const totalProcessed = stats.clients.processed + stats.investors.processed + stats.capinvestors.processed;
  const totalFailed = stats.clients.failed + stats.investors.failed + stats.capinvestors.failed;
  const totalEmailsSent = stats.clients.emailsSent + stats.investors.emailsSent + stats.capinvestors.emailsSent;
  const totalNoEmail = stats.clients.noEmail + stats.investors.noEmail + stats.capinvestors.noEmail;
  console.log(`TOTAL: ${totalProcessed} successful, ${totalFailed} failed`);
  console.log(`EMAILS: ${totalEmailsSent} sent, ${totalNoEmail} no email found`);

  // Return results instead of exiting (so we don't kill the server when called from API)
  return {
    success: totalFailed === 0,
    stats: {
      clients: stats.clients,
      investors: stats.investors,
      capinvestors: stats.capinvestors,
      totalProcessed,
      totalFailed,
      totalEmailsSent,
      totalNoEmail
    }
  };
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { main };
