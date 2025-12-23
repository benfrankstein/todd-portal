'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add email tracking fields to invoices table
    await queryInterface.addColumn('invoices', 'email_sent', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether invoice email was sent successfully'
    });

    await queryInterface.addColumn('invoices', 'email_sent_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when invoice email was sent'
    });

    await queryInterface.addColumn('invoices', 'email_recipient', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Email address the invoice was sent to'
    });

    await queryInterface.addColumn('invoices', 'email_error', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Error message if email sending failed'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove email tracking fields
    await queryInterface.removeColumn('invoices', 'email_sent');
    await queryInterface.removeColumn('invoices', 'email_sent_at');
    await queryInterface.removeColumn('invoices', 'email_recipient');
    await queryInterface.removeColumn('invoices', 'email_error');
  }
};
