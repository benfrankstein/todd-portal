'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('app_settings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      setting_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      setting_value: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Insert default summary report emails
    await queryInterface.bulkInsert('app_settings', [{
      setting_key: 'invoice_summary_emails',
      setting_value: 'todd@coastalprivatelending.com,ashley@coastalprivatelending.com,benjamin.frankstein@gmail.com',
      description: 'Comma-separated list of email addresses to receive invoice generation summary reports',
      created_at: new Date(),
      updated_at: new Date()
    }]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('app_settings');
  }
};
