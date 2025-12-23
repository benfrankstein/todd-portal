require('dotenv').config();
const db = require('../models');

async function clearInvoices() {
  try {
    console.log('Connecting to database...');
    await db.sequelize.authenticate();
    console.log('Connected successfully');

    console.log('Clearing invoices table...');
    const deleted = await db.Invoice.destroy({
      where: {},
      truncate: true
    });

    console.log(`✓ Cleared invoices table (${deleted} records deleted)`);
    process.exit(0);
  } catch (error) {
    console.error('Error clearing invoices:', error);
    process.exit(1);
  }
}

clearInvoices();
