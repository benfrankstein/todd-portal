'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('funded', 'closing_date', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Closing date from Google Sheets column N (index 13)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('funded', 'closing_date');
  }
};
