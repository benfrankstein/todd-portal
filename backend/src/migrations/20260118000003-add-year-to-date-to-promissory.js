'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('promissory', 'year_to_date', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Year to date amount from Google Sheets column Q (index 16)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('promissory', 'year_to_date');
  }
};
