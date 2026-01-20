module.exports = (sequelize, DataTypes) => {
  const InvoiceLineItem = sequelize.define('InvoiceLineItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    invoiceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'invoice_id',
      references: {
        model: 'invoices',
        key: 'id'
      }
    },
    loanTable: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'loan_table',
      validate: {
        isIn: [['promissory', 'capinvestor', 'funded']]
      }
    },
    loanId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'loan_id'
    },
    loanIdentifier: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'loan_identifier'
    },
    originalAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'original_amount'
    },
    proratedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'prorated_amount'
    },
    isProrated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_prorated'
    },
    prorationType: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'proration_type',
      validate: {
        isIn: [['first_month', 'last_month', null]]
      }
    },
    periodStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'period_start_date'
    },
    periodEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'period_end_date'
    },
    daysInPeriod: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'days_in_period'
    },
    totalDaysInMonth: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'total_days_in_month'
    }
  }, {
    tableName: 'invoice_line_items',
    underscored: true,
    indexes: [
      {
        fields: ['invoice_id'],
        name: 'idx_line_items_invoice'
      },
      {
        fields: ['loan_table', 'loan_id'],
        name: 'idx_line_items_loan'
      }
    ]
  });

  InvoiceLineItem.associate = (models) => {
    InvoiceLineItem.belongsTo(models.Invoice, {
      foreignKey: 'invoiceId',
      as: 'invoice'
    });
  };

  return InvoiceLineItem;
};
