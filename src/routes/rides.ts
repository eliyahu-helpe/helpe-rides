import express from "express";
import { gtfsController } from "../controllers/gtfsController";
import { siriControler } from "../controllers/siriController";

const routers = express.Router();

routers.post("/gtfs", gtfsController.getLineDetails);
// routers.post("/siri", siriControler.getLineDetails);

export default routers;
