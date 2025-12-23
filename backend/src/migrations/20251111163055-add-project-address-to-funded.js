'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('funded', 'project_address', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'business_name'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('funded', 'project_address');
  }
};
