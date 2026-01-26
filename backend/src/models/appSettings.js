module.exports = (sequelize, DataTypes) => {
  const AppSettings = sequelize.define('AppSettings', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    settingKey: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'setting_key'
    },
    settingValue: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'setting_value'
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true
    }
  }, {
    tableName: 'app_settings',
    timestamps: true,
    underscored: true
  });

  return AppSettings;
};
