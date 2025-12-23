'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('promissory', 'type', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Type of loan from column E (index 4) without parsing'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('promissory', 'type');
  }
};
