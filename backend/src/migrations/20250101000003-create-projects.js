module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('projects', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      projectName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      propertyAddress: {
        type: Sequelize.STRING,
        allowNull: false
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true
      },
      state: {
        type: Sequelize.STRING,
        allowNull: true
      },
      zipCode: {
        type: Sequelize.STRING,
        allowNull: true
      },
      loanAmount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      interestRate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      loanTerm: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM(
          'Application',
          'Under Review',
          'Approved',
          'Active',
          'Completed',
          'Declined',
          'Cancelled'
        ),
        defaultValue: 'Application'
      },
      startDate: {
        type: Sequelize.DATE,
        allowNull: true
      },
      maturityDate: {
        type: Sequelize.DATE,
        allowNull: true
      },
      propertyType: {
        type: Sequelize.STRING,
        allowNull: true
      },
      propertyValue: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      loanToValue: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      clientId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'clients',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex('projects', ['clientId']);
    await queryInterface.addIndex('projects', ['status']);
    await queryInterface.addIndex('projects', ['propertyAddress']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('projects');
  }
};
