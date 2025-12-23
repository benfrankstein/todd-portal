'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('email_templates', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      template_name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      subject: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      greeting: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      body_message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      closing_message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      signature: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add index on template_name for faster lookups
    await queryInterface.addIndex('email_templates', ['template_name']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('email_templates');
  }
};
