'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('funded', 'email', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('funded', 'first_name', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('funded', 'last_name', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('funded', 'email');
    await queryInterface.removeColumn('funded', 'first_name');
    await queryInterface.removeColumn('funded', 'last_name');
  }
};
