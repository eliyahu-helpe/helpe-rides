import { Request, Response } from "express";
import DatabaseManager from "../db/dbInstance";
import { runQuery } from "../services/dbService";
import axios from "axios";

class SiriController {
  getLineDetails = async (req: Request, res: Response): Promise<void> => {
    const { lineId, text } = req.body;
    try {
      // SQL query to get stop_id based on route_short_name and stop_name
      const query = `
        SELECT DISTINCT st.stop_id
        FROM stops st
        WHERE st.stop_name LIKE '%${text}%' 
        AND EXISTS (
          SELECT 1
          FROM stop_times stt
          JOIN trips t ON stt.trip_id = t.trip_id
          JOIN routes r ON t.route_id = r.route_id
          WHERE stt.stop_id = st.stop_id
          AND r.route_short_name = ?
        );
      `;

      // Execute the query
      const results = await runQuery(query, [lineId]);

      // Array to hold all axios requests
      const arrivalPromises = results.map(async (stopId) => {
        try {
          const arrivalTimeResponse = await axios.get(
            `https://open-bus-stride-api.hasadna.org.il/stop_arrivals/list?get_count=false&gtfs_stop_id=${stopId.stop_id}`
          );
          console.log(arrivalTimeResponse.data);
          return {
            stopId: stopId.stop_id,
            arrivalData: arrivalTimeResponse.data[0].actual_arrival_time,
          };
        } catch (err) {
          return { stopId: stopId.stop_id, error: err };
        }
      });

      // Wait for all axios requests to finish
      const arrivalDataResults = await Promise.all(arrivalPromises);

      // Send both the results from the query and the arrival times
      //   res.send({ stopIds: results, arrivalData: arrivalDataResults });
      res.send(results);
    } catch (error) {
      res
        .status(500)
        .json({ error: "An error occurred while fetching details" });
    }
  };
}

export const siriControler = new SiriController();
