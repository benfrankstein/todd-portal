'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('promissory', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      status: {
        type: Sequelize.STRING,
        allowNull: true
      },
      investor_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      investor_email: {
        type: Sequelize.STRING,
        allowNull: true
      },
      asset_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Parsed S001 number from asset ID field'
      },
      fund_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      maturity_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      loan_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      payoff_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      interest_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      capital_pay: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      last_seen_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of last sync - used to identify stale records'
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

    // Add index on investor_email for faster lookups
    await queryInterface.addIndex('promissory', ['investor_email'], {
      name: 'promissory_investor_email_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('promissory');
  }
};
