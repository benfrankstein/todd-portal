'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('capinvestor', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      property_address: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Property address from column A (index 0)'
      },
      investor_name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Cap investor name (from index 1, 7, or 13)'
      },
      loan_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        comment: 'Loan amount (from index 2, 8, or 14)'
      },
      interest_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Interest rate (from index 4, 10, or 16)'
      },
      payment: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        comment: 'Payment amount (from index 6, 12, or 18)'
      },
      fund_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fund date from column U (index 20)'
      },
      payoff_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Payoff date from column AE (index 30)'
      },
      loan_status: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Loan status from column AF (index 31)'
      },
      last_seen_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp for tracking sync'
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

    // Add composite index for property_address + investor_name
    await queryInterface.addIndex('capinvestor', ['property_address', 'investor_name'], {
      name: 'capinvestor_property_investor_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('capinvestor');
  }
};
