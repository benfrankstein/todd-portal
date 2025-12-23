'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add lastSeenAt column
    await queryInterface.addColumn('funded', 'last_seen_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Add composite unique index on business_name + project_address
    await queryInterface.addIndex('funded', ['business_name', 'project_address'], {
      name: 'funded_business_project_unique',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index first
    await queryInterface.removeIndex('funded', 'funded_business_project_unique');

    // Remove column
    await queryInterface.removeColumn('funded', 'last_seen_at');
  }
};
