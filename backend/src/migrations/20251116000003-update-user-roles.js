'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // PostgreSQL requires a specific approach to modify ENUM types
    // We need to add new values to the existing enum
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'borrower';
    `);

    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'promissory';
    `);

    // Update existing 'client' role to 'borrower' if any exist
    await queryInterface.sequelize.query(`
      UPDATE users SET role = 'borrower' WHERE role = 'client';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Note: PostgreSQL doesn't support removing enum values easily
    // To rollback, we would need to recreate the enum type
    // For safety, we'll just update the data back
    await queryInterface.sequelize.query(`
      UPDATE users SET role = 'client' WHERE role = 'borrower';
    `);

    // Removing enum values requires recreating the type, which is complex
    // and risky in production. We'll leave the enum values in place.
    console.log('Note: enum values "borrower" and "promissory" are not removed from the enum type for safety.');
  }
};
