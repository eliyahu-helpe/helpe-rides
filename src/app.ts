import express from "express";
import { config as dotenvConfig } from "dotenv";
import rideRoutes from "./routes/rides";
import { indexDb } from "./indexdb";

dotenvConfig();

const app = express();
app.use(express.json());

// const preparDb = async () => {
//   await indexDb.stopTimeIndex();
// };
// preparDb();
app.use("/", rideRoutes);
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;
