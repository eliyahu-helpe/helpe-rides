import express from "express";
import { config as dotenvConfig } from "dotenv";
import rideRoutes from "./routes/rides";
import { downloadAndExtractGTFS, runGTFSImport } from "./db/updateDb";
import * as dotenv from "dotenv";
dotenv.config();
const app = express();
app.use(express.json());

// const preparDb = async () => {
//   await indexDb.stopTimeIndex();
// };
// preparDb();
app.use("/", rideRoutes);
const port = process.env.PORT || 3000;
app.listen(port, async () => {
  console.log(`Server is running on port ${port}`, process.env.NODE_ENV);

  if (process.env.NODE_ENV === "production") {
    await downloadAndExtractGTFS(
      "https://gtfs.mot.gov.il/gtfsfiles/israel-public-transportation.zip"
    );
    await runGTFSImport();
  }
});

export default app;
