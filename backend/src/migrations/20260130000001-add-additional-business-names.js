'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add additional_business_names column as an array
    await queryInterface.addColumn('users', 'additional_business_names', {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: true,
      defaultValue: []
    });

    console.log('✓ Successfully added additional_business_names column');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the additional_business_names column
    await queryInterface.removeColumn('users', 'additional_business_names');

    console.log('✓ Successfully removed additional_business_names column');
  }
};
