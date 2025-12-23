'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'capinvestor' to the user role enum
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'capinvestor';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Note: PostgreSQL doesn't support removing enum values easily
    // This would require recreating the enum type
    console.log('Removing enum values requires manual intervention');
  }
};
