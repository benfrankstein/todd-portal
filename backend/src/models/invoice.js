module.exports = (sequelize, DataTypes) => {
  const Invoice = sequelize.define('Invoice', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    businessName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'business_name'
    },
    role: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['client', 'investor', 'capinvestor']]
      }
    },
    invoiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'invoice_date'
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'file_name'
    },
    s3Key: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 's3_key'
    },
    s3Url: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 's3_url'
    },
    totalAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: 'total_amount'
    },
    recordCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'record_count'
    },
    emailSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'email_sent'
    },
    emailSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'email_sent_at'
    },
    emailRecipient: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'email_recipient'
    },
    emailError: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'email_error'
    }
  }, {
    tableName: 'invoices',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['business_name', 'role', 'invoice_date'],
        name: 'unique_invoice_per_business_date'
      },
      {
        fields: ['business_name'],
        name: 'idx_invoices_business'
      },
      {
        fields: ['invoice_date'],
        name: 'idx_invoices_date'
      },
      {
        fields: ['role'],
        name: 'idx_invoices_role'
      }
    ]
  });

  return Invoice;
};
