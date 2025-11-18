import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../database";

interface UserPreferenceAttributes {
  id: number;
  userId: number;
  emailUpdates: boolean;
  analysisComplete: boolean;
  weeklyTips: boolean;
  promotions: boolean;
}

type UserPreferenceCreationAttributes = Optional<UserPreferenceAttributes, "id">;

class UserPreference
  extends Model<UserPreferenceAttributes, UserPreferenceCreationAttributes>
  implements UserPreferenceAttributes
{
  public id!: number;
  public userId!: number;
  public emailUpdates!: boolean;
  public analysisComplete!: boolean;
  public weeklyTips!: boolean;
  public promotions!: boolean;
}

UserPreference.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      unique: true,
    },
    emailUpdates: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    analysisComplete: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    weeklyTips: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    promotions: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
  },
  {
    tableName: "user_preferences",
    sequelize,
  }
);

export default UserPreference;
