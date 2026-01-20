'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('capinvestor', 'year_to_date', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Year-to-date payment amount from Cap Investor Payments sheet'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('capinvestor', 'year_to_date');
  }
};
