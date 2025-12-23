require('dotenv').config();
const db = require('../models');

async function createAdmin() {
  try {
    console.log('Connecting to database...');
    await db.sequelize.authenticate();
    console.log('Connected successfully');

    // Check if admin already exists
    const existing = await db.User.findOne({
      where: { email: 'admin@coastalprivatelending.com' }
    });

    if (existing) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create admin user
    const admin = await db.User.create({
      email: 'admin@coastalprivatelending.com',
      password: 'root', // Will be hashed by model hook
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
      firstTime: false // Admin doesn't need to reset password
    });

    console.log('✓ Admin user created successfully');
    console.log('  Email: admin@coastalprivatelending.com');
    console.log('  Password: root');
    console.log('  Role: admin');

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

createAdmin();
