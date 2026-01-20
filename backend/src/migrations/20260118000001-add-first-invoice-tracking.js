'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add first_invoice_generated_at to Funded table
    await queryInterface.addColumn('funded', 'first_invoice_generated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when the first prorated invoice was generated for this loan'
    });

    // Add first_invoice_generated_at to Promissory table
    await queryInterface.addColumn('promissory', 'first_invoice_generated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when the first prorated invoice was generated for this loan'
    });

    // Add first_invoice_generated_at to CapInvestor table
    await queryInterface.addColumn('capinvestor', 'first_invoice_generated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when the first prorated invoice was generated for this loan'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('funded', 'first_invoice_generated_at');
    await queryInterface.removeColumn('promissory', 'first_invoice_generated_at');
    await queryInterface.removeColumn('capinvestor', 'first_invoice_generated_at');
  }
};
