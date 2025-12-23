require('dotenv').config();
const db = require('./src/models');

async function createAdmin() {
  try {
    console.log('Creating admin user...');

    // Check if admin already exists
    const existing = await db.User.findOne({ where: { email: 'admin@coastalprivatelending.com' } });

    if (existing) {
      console.log('✓ Admin user already exists');
      console.log('Email: admin@coastalprivatelending.com');
      console.log('Password: root');
      process.exit(0);
    }

    // Create admin user
    await db.User.create({
      email: 'admin@coastalprivatelending.com',
      password: 'root', // Will be hashed by model hook
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      businessName: null,
      isActive: true
    });

    console.log('✓ Admin user created successfully!');
    console.log('\nLogin credentials:');
    console.log('Email: admin@coastalprivatelending.com');
    console.log('Password: root');
    console.log('\nYou can now log in through the frontend.');

    process.exit(0);

  } catch (error) {
    console.error('✗ Error creating admin:', error.message);
    process.exit(1);
  }
}

createAdmin();
