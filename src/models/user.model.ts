import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

class User extends Model {
  public id!: number;
  public name!: string;
  public email!: string;
  public password!: string;
  public role!: 'free' | 'paid';
  public emailVerified!: boolean;
  public emailVerificationToken?: string;
  public emailVerificationExpires?: Date;
  public passwordResetToken?: string;
  public passwordResetExpires?: Date;
  public analysisQuota!: number;
  public lastQuotaReset!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    email: {
      type: new DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
    password: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    role: {
      type: new DataTypes.ENUM('free', 'paid'),
      defaultValue: 'free',
      allowNull: false,
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    emailVerificationToken: {
      type: new DataTypes.STRING(128),
      allowNull: true,
    },
    emailVerificationExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    analysisQuota: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
    },
    lastQuotaReset: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    passwordResetToken: {
      type: new DataTypes.STRING(128),
      allowNull: true,
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'users',
    sequelize,
    timestamps: true,
  }
);

export default User;
