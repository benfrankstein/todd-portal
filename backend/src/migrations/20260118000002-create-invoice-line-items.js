'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('invoice_line_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      invoice_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'invoices',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Foreign key to invoices table'
      },
      loan_table: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Source table: promissory, capinvestor, or funded'
      },
      loan_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'UUID of the loan record from the source table'
      },
      loan_identifier: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Human-readable identifier (business/investor name + address/asset)'
      },
      original_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Full monthly payment amount before proration'
      },
      prorated_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Actual amount invoiced (may be prorated or full)'
      },
      is_prorated: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this line item was prorated'
      },
      proration_type: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Type of proration: first_month, last_month, or null'
      },
      period_start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Start date of the period covered by this line item'
      },
      period_end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'End date of the period covered by this line item'
      },
      days_in_period: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Number of days in the period covered'
      },
      total_days_in_month: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Total days in the month (for proration calculation)'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Add indexes
    await queryInterface.addIndex('invoice_line_items', ['invoice_id'], {
      name: 'idx_line_items_invoice'
    });

    await queryInterface.addIndex('invoice_line_items', ['loan_table', 'loan_id'], {
      name: 'idx_line_items_loan'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('invoice_line_items');
  }
};
