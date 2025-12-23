module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop old tables
    await queryInterface.dropTable('projects');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('clients');

    // Create new funded table with exact columns from Google Sheet
    await queryInterface.createTable('funded', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      businessName: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'business_name'
      },
      constructionCost: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        field: 'construction_cost'
      },
      constructionLeftInEscrow: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        field: 'construction_left_in_escrow'
      },
      loanAmount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        field: 'loan_amount'
      },
      interestRate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        field: 'interest_rate'
      },
      interestPayment: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        field: 'interest_payment'
      },
      maturityDate: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'maturity_date'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'created_at'
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'updated_at'
      }
    });

    // Add index on business name for faster lookups
    await queryInterface.addIndex('funded', ['business_name']);

    // Recreate users table (keep it simple)
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'first_name'
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'last_name'
      },
      role: {
        type: Sequelize.ENUM('admin', 'staff', 'client'),
        defaultValue: 'client'
      },
      businessName: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'business_name',
        comment: 'Links user to their business in funded table'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        field: 'is_active'
      },
      lastLogin: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'last_login'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'created_at'
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'updated_at'
      }
    });

    await queryInterface.addIndex('users', ['email']);
    await queryInterface.addIndex('users', ['business_name']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('funded');
    await queryInterface.dropTable('users');
  }
};
