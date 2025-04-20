import express from "express";
import gtfController from "../controllers/gtfsNew";

const routers = express.Router();

routers.post("/lineDetails", gtfController.getLineDetails);
routers.post("/stopDetailsByStopCode", gtfController.getDetailsByStopCode);
routers.post("/getDetailsByRouteId", gtfController.getDetailsByRouteId);

export default routers;
