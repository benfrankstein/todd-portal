module.exports = (sequelize, DataTypes) => {
  const Funded = sequelize.define('Funded', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    businessName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'business_name'
    },
    projectAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'project_address'
    },
    constructionCost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'construction_cost'
    },
    constructionLeftInEscrow: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'construction_left_in_escrow'
    },
    loanAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'loan_amount'
    },
    interestRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'interest_rate'
    },
    interestPayment: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'interest_payment'
    },
    maturityDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'maturity_date'
    },
    closingDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'closing_date'
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_seen_at'
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'email'
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'first_name'
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'last_name'
    }
  }, {
    tableName: 'funded',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['business_name', 'project_address'],
        name: 'funded_business_project_unique'
      }
    ]
  });

  return Funded;
};
