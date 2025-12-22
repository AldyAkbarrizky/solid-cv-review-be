import { Model, DataTypes } from 'sequelize';
import sequelize from '../database';

class Analysis extends Model {
  public id!: number;
  public userId!: number;
  public jobTitle!: string;
  public company!: string;
  public jobDescription!: string;
  public cvText!: string;
  public score!: number;
  public status!: 'excellent' | 'good' | 'needs-improvement';
  public analysisResult!: any; // Stores the full JSON structure
  public interviewQuestions!: any;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Analysis.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    jobTitle: {
      type: new DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'Unknown Position',
    },
    company: {
      type: new DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'Unknown Company',
    },
    jobDescription: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    cvText: {
      type: DataTypes.TEXT('long'), // Allow large text
      allowNull: false,
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('excellent', 'good', 'needs-improvement'),
      allowNull: false,
      defaultValue: 'needs-improvement',
    },
    analysisResult: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    summaryOptions: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    coverLetter: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    coverLetterTips: {
      type: DataTypes.JSON, // Stores tips object including strengths array
      allowNull: true,
    },
    interviewQuestions: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: 'analyses',
    sequelize,
    timestamps: true,
  }
);

export default Analysis;
