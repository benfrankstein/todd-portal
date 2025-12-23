require('dotenv').config();
const db = require('../models');

async function clearUsers() {
  try {
    console.log('Connecting to database...');
    await db.sequelize.authenticate();
    console.log('Connected successfully');

    console.log('Clearing users table...');
    const deleted = await db.User.destroy({
      where: {},
      truncate: true
    });

    console.log(`✓ Cleared users table (${deleted} records deleted)`);
    process.exit(0);
  } catch (error) {
    console.error('Error clearing users:', error);
    process.exit(1);
  }
}

clearUsers();
