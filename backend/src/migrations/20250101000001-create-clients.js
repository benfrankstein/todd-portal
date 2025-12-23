module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('clients', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      businessName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      legalEntityName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      entityType: {
        type: Sequelize.ENUM('LLC', 'Corporation', 'Partnership', 'Sole Proprietorship', 'Other'),
        allowNull: true
      },
      taxId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      primaryContactName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      primaryContactEmail: {
        type: Sequelize.STRING,
        allowNull: false
      },
      primaryContactPhone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      businessAddress: {
        type: Sequelize.STRING,
        allowNull: true
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
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
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

    await queryInterface.addIndex('clients', ['businessName']);
    await queryInterface.addIndex('clients', ['primaryContactEmail']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('clients');
  }
};
