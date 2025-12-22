import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import sequelize from "./database";

const port = process.env.PORT || 8000;

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection has been established successfully.");
    await sequelize.sync(); // Syncs models to DB, updating table structures if needed
    console.log("All models were synchronized successfully.");
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};

export default start;
