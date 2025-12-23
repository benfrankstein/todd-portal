module.exports = (sequelize, DataTypes) => {
  const Promissory = sequelize.define('Promissory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'status'
    },
    investorName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'investor_name'
    },
    investorEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'investor_email'
    },
    assetId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'asset_id'
    },
    type: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'type'
    },
    fundDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'fund_date'
    },
    maturityDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'maturity_date'
    },
    loanAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'loan_amount'
    },
    payoffDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'payoff_date'
    },
    interestRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'interest_rate'
    },
    capitalPay: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'capital_pay'
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_seen_at'
    }
  }, {
    tableName: 'promissory',
    timestamps: true,
    underscored: true
  });

  return Promissory;
};
