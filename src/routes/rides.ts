import express from "express";
import gtfController from "../controllers/gtfsNew";
import { downloadAndExtractGTFS, runGTFSImport } from "../db/updateDb";

const routers = express.Router();

routers.post("/lineDetails", gtfController.getLineDetails);
routers.post("/stopDetailsByStopCode", gtfController.getDetailsByStopCode);
routers.post("/getDetailsByRouteId", gtfController.getDetailsByRouteId);
routers.get("/updateDb", async (req, res) => {
  await downloadAndExtractGTFS(
    "https://gtfs.mot.gov.il/gtfsfiles/israel-public-transportation.zip"
  );
  await runGTFSImport();
  res.send("success");
});
export default routers;
