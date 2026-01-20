module.exports = (sequelize, DataTypes) => {
  const CapInvestor = sequelize.define('CapInvestor', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    propertyAddress: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'property_address'
    },
    investorName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'investor_name'
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
    payment: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'payment'
    },
    fundDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'fund_date'
    },
    payoffDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'payoff_date'
    },
    loanStatus: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'loan_status'
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_seen_at'
    },
    firstInvoiceGeneratedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'first_invoice_generated_at'
    },
    yearToDate: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: 'year_to_date'
    }
  }, {
    tableName: 'capinvestor',
    timestamps: true,
    underscored: true
  });

  return CapInvestor;
};
