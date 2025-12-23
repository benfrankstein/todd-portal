'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('invoices', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      business_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      role: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'client, investor, or capinvestor'
      },
      invoice_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      s3_key: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      s3_url: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      total_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      record_count: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add unique constraint for business_name + role + invoice_date
    await queryInterface.addConstraint('invoices', {
      fields: ['business_name', 'role', 'invoice_date'],
      type: 'unique',
      name: 'unique_invoice_per_business_date'
    });

    // Add indexes for faster queries
    await queryInterface.addIndex('invoices', ['business_name'], {
      name: 'idx_invoices_business'
    });

    await queryInterface.addIndex('invoices', ['invoice_date'], {
      name: 'idx_invoices_date'
    });

    await queryInterface.addIndex('invoices', ['role'], {
      name: 'idx_invoices_role'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('invoices');
  }
};
