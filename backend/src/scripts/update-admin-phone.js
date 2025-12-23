require('dotenv').config();
const db = require('../models');

async function updateAdminPhone() {
  try {
    await db.sequelize.authenticate();
    console.log('Database connected');

    // Find admin user
    const admin = await db.User.findOne({
      where: { email: 'admin@coastalprivatelending.com' }
    });

    if (!admin) {
      console.log('Admin user not found');
      process.exit(1);
    }

    console.log('Found admin user:', admin.email);

    // Update phone number
    await admin.update({
      phoneNumber: '9736150406'
    });

    console.log('Admin phone number updated to: 9736150406');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateAdminPhone();
