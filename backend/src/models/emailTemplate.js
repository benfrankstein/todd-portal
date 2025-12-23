module.exports = (sequelize, DataTypes) => {
  const EmailTemplate = sequelize.define('EmailTemplate', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    templateName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: 'template_name',
      validate: {
        isIn: [['invoice_client', 'invoice_investor', 'invoice_capinvestor', 'user_welcome']]
      }
    },
    subject: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    greeting: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    bodyMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'body_message'
    },
    closingMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'closing_message'
    },
    signature: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: 'is_active'
    }
  }, {
    tableName: 'email_templates',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return EmailTemplate;
};
