import app from "./app";
import sequelize from "./database";

const port = process.env.PORT || 8000;

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection has been established successfully.");
    await sequelize.sync(); // or sync({ force: true }) to drop and re-create tables
    console.log("All models were synchronized successfully.");
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};

export default start;
