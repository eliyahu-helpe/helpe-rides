import { Request, RequestHandler, Response } from "express";
import { runQuery } from "../services/dbService";
interface Schedule {
  sunday: string[];
  monday: string[];
  tuesday: string[];
  wednesday: string[];
  thursday: string[];
  friday: string[];
  saturday: string[];
}

// Initialize the schedule with proper typing

class GtfsNewController {
  getLineDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      // Get parameters from request body
      const { routeShortName, agencyId } = req.body;

      if (!routeShortName) {
        res.status(400).json({ error: "Route short name is required" });
        return;
      }

      // Construct the query with optional agency_id filter
      let routeQuery = `
        SELECT 
          r.route_id,
          r.route_short_name,
          r.route_long_name as long_name,
          a.agency_id,
          a.agency_name
        FROM routes r
        JOIN agency a ON r.agency_id = a.agency_id
        WHERE r.route_short_name = ?
      `;

      let queryParams = [routeShortName];

      // Add agency_id filter if provided
      if (agencyId) {
        routeQuery += ` AND a.agency_id = ?`;
        queryParams.push(agencyId);
      }

      const routeResults = await runQuery(routeQuery, queryParams);

      if (routeResults.length === 0) {
        res.status(404).json({ error: "Route not found" });
        return;
      }

      // Process all matching routes
      const resultArray = [];

      for (const routeResult of routeResults) {
        const routeId = routeResult.route_id;

        // Rest of the code remains the same...
        // [existing implementation for getting stops, schedule, etc.]

        // Get a representative trip for this route
        const tripQuery = `
          SELECT trip_id 
          FROM trips 
          WHERE route_id = ? 
          LIMIT 1
        `;

        const tripResult = await runQuery(tripQuery, [routeId]);

        if (!tripResult.length) {
          // Skip this route if no trips found
          continue;
        }

        const tripId = tripResult[0].trip_id;

        // Get stops for this trip with arrival times
        const stopsQuery = `
          SELECT 
            s.stop_name,
            s.stop_code,
            st.arrival_time,
            st.stop_sequence
          FROM stops s
          JOIN stop_times st ON s.stop_id = st.stop_id
          WHERE st.trip_id = ?
          ORDER BY st.stop_sequence
        `;

        const stopsData = await runQuery(stopsQuery, [tripId]);

        // Process stops to calculate relative time differences
        const stops = [];
        let previousTime = null;

        for (let i = 0; i < stopsData.length; i++) {
          const currentStop = stopsData[i];
          let relativeTime = "00:00";

          if (i === 0) {
            // First stop is always 00:00
            relativeTime = "00:00";
            previousTime = currentStop.arrival_time;
          } else {
            // Calculate time difference from previous stop
            const currentTime = currentStop.arrival_time;

            // Parse time strings (assuming format HH:MM:SS)
            const prevTimeParts = previousTime.split(":").map(Number);
            const currTimeParts = currentTime.split(":").map(Number);

            // Convert to minutes
            const prevMinutes = prevTimeParts[0] * 60 + prevTimeParts[1];
            const currMinutes = currTimeParts[0] * 60 + currTimeParts[1];

            // Calculate difference in minutes
            let diffMinutes = currMinutes - prevMinutes;

            // Handle cases where the trip crosses midnight
            if (diffMinutes < 0) {
              diffMinutes += 24 * 60;
            }

            // Format correctly with hours if needed
            const hours = Math.floor(diffMinutes / 60);
            const minutes = diffMinutes % 60;

            if (hours > 0) {
              relativeTime = `${hours.toString().padStart(2, "0")}:${minutes
                .toString()
                .padStart(2, "0")}`;
            } else {
              relativeTime = `00:${minutes.toString().padStart(2, "0")}`;
            }

            // Update previous time for next iteration
            previousTime = currentTime;
          }

          stops.push({
            stop_name: currentStop.stop_name,
            relative_stop_time: relativeTime,
            stop_code: currentStop.stop_code,
          });
        }

        // Get first and last stop names
        const firstStopName = stops.length > 0 ? stops[0].stop_name : "";
        const lastStopName =
          stops.length > 0 ? stops[stops.length - 1].stop_name : "";

        // Calculate total duration
        let duration = "00:00";
        if (stopsData.length > 1) {
          const firstTime = stopsData[0].arrival_time;
          const lastTime = stopsData[stopsData.length - 1].arrival_time;

          const firstParts = firstTime.split(":").map(Number);
          const lastParts = lastTime.split(":").map(Number);

          let firstMinutes = firstParts[0] * 60 + firstParts[1];
          let lastMinutes = lastParts[0] * 60 + lastParts[1];

          // Handle cases where the trip crosses midnight
          if (lastMinutes < firstMinutes) {
            lastMinutes += 24 * 60;
          }

          const diffMinutes = lastMinutes - firstMinutes;
          const hours = Math.floor(diffMinutes / 60);
          const minutes = diffMinutes % 60;

          duration = `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}`;
        }

        // Get schedule information - prevent duplicates
        const scheduleQuery = `
          SELECT DISTINCT
            c.sunday, c.monday, c.tuesday, c.wednesday, 
            c.thursday, c.friday, c.saturday,c.start_date, c.end_date,
            st.departure_time
          FROM trips t
          JOIN stop_times st ON t.trip_id = st.trip_id
          JOIN calendar c ON t.service_id = c.service_id
          WHERE t.route_id = ?
          AND st.stop_sequence = (
            SELECT MIN(stop_sequence)
            FROM stop_times
            WHERE trip_id = t.trip_id
          )
          ORDER BY st.departure_time
        `;

        const scheduleResults = await runQuery(scheduleQuery, [routeId]);

        // Initialize the schedule
        const schedule = {
          sunday: [] as string[],
          monday: [] as string[],
          tuesday: [] as string[],
          wednesday: [] as string[],
          thursday: [] as string[],
          friday: [] as string[],
          saturday: [] as string[],
          start_date: "",
          end_date: "",
        };

        // Helper to deduplicate times
        const addUniqueTime = (day: string[], time: string) => {
          if (!day.includes(time)) {
            day.push(time);
          }
        };

        // Process schedule results
        scheduleResults.forEach((trip) => {
          schedule.start_date = this.formatDateString(
            trip.start_date.toString()
          );
          schedule.end_date = this.formatDateString(trip.end_date.toString());
          if (trip.sunday === 1)
            addUniqueTime(schedule.sunday, trip.departure_time);
          if (trip.monday === 1)
            addUniqueTime(schedule.monday, trip.departure_time);
          if (trip.tuesday === 1)
            addUniqueTime(schedule.tuesday, trip.departure_time);
          if (trip.wednesday === 1)
            addUniqueTime(schedule.wednesday, trip.departure_time);
          if (trip.thursday === 1)
            addUniqueTime(schedule.thursday, trip.departure_time);
          if (trip.friday === 1)
            addUniqueTime(schedule.friday, trip.departure_time);
          if (trip.saturday === 1)
            addUniqueTime(schedule.saturday, trip.departure_time);
        });

        // Format route result
        const routeDetails = {
          ...routeResult,
          stops,
          first_stop_name: firstStopName,
          last_stop_name: lastStopName,
          duration,
          schedule,
        };

        resultArray.push(routeDetails);
      }

      // Send the array of results
      res.json(resultArray);
    } catch (error) {
      console.error("Error fetching line details:", error);
      res.status(500).json({
        error: "Failed to fetch line details",
        details: error,
      });
    }
  };

  getDetailsByStopCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { stopCode } = req.body;

      if (!stopCode) {
        res.status(400).json({ error: "Stop code is required" });
        return;
      }

      // Query to get stop information
      const stopQuery = `
        SELECT stop_id, stop_name
        FROM stops
        WHERE stop_code = ?
      `;

      const stopResults = await runQuery(stopQuery, [stopCode]);

      if (!stopResults || stopResults.length === 0) {
        res.status(404).json({ error: "Stop not found" });
        return;
      }

      const stopId = stopResults[0].stop_id;

      // Query to get routes serving this stop
      const routesQuery = `
        SELECT DISTINCT r.route_short_name, route_long_name
        FROM routes r
        JOIN trips t ON r.route_id = t.route_id
        JOIN stop_times st ON t.trip_id = st.trip_id
        WHERE st.stop_id = ?
      `;

      const routesResults = await runQuery(routesQuery, [stopId]);

      // Return combined results
      res.status(200).json({
        stop: stopResults[0],
        routes: routesResults,
      });
    } catch (error) {
      console.error("Error fetching stop details:", error);
      res.status(500).json({ error: "Failed to fetch stop details" });
    }
  };

  getDetailsByRouteId = async (req: Request, res: Response): Promise<void> => {
    try {
      // Get parameters from request body
      const { routeId, agencyId } = req.body;

      if (!routeId) {
        res.status(400).json({ error: "Route ID is required" });
        return;
      }

      // Construct the query with optional agency_id filter
      let routeQuery = `
        SELECT 
          r.route_id,
          r.route_short_name,
          r.route_long_name as long_name,
          a.agency_id,
          a.agency_name
        FROM routes r
        JOIN agency a ON r.agency_id = a.agency_id
        WHERE r.route_id = ?
      `;

      let queryParams = [routeId];

      // Add agency_id filter if provided
      if (agencyId) {
        routeQuery += ` AND a.agency_id = ?`;
        queryParams.push(agencyId);
      }

      const routeResults = await runQuery(routeQuery, queryParams);

      if (routeResults.length === 0) {
        res.status(404).json({ error: "Route not found" });
        return;
      }

      // Process all matching routes
      const resultArray = [];

      for (const routeResult of routeResults) {
        const routeId = routeResult.route_id;

        // Get a representative trip for this route
        const tripQuery = `
          SELECT trip_id 
          FROM trips 
          WHERE route_id = ? 
          LIMIT 1
        `;

        const tripResult = await runQuery(tripQuery, [routeId]);

        if (!tripResult.length) {
          // Skip this route if no trips found
          continue;
        }

        const tripId = tripResult[0].trip_id;

        // Get stops for this trip with arrival times
        const stopsQuery = `
          SELECT 
            s.stop_name,
            s.stop_code,
            st.arrival_time,
            st.stop_sequence
          FROM stops s
          JOIN stop_times st ON s.stop_id = st.stop_id
          WHERE st.trip_id = ?
          ORDER BY st.stop_sequence
        `;

        const stopsData = await runQuery(stopsQuery, [tripId]);

        // Process stops to calculate relative time differences
        const stops = [];
        let previousTime = null;

        for (let i = 0; i < stopsData.length; i++) {
          const currentStop = stopsData[i];
          let relativeTime = "00:00";

          if (i === 0) {
            // First stop is always 00:00
            relativeTime = "00:00";
            previousTime = currentStop.arrival_time;
          } else {
            // Calculate time difference from previous stop
            const currentTime = currentStop.arrival_time;

            // Parse time strings (assuming format HH:MM:SS)
            const prevTimeParts = previousTime.split(":").map(Number);
            const currTimeParts = currentTime.split(":").map(Number);

            // Convert to minutes
            const prevMinutes = prevTimeParts[0] * 60 + prevTimeParts[1];
            const currMinutes = currTimeParts[0] * 60 + currTimeParts[1];

            // Calculate difference in minutes
            let diffMinutes = currMinutes - prevMinutes;

            // Handle cases where the trip crosses midnight
            if (diffMinutes < 0) {
              diffMinutes += 24 * 60;
            }

            // Format correctly with hours if needed
            const hours = Math.floor(diffMinutes / 60);
            const minutes = diffMinutes % 60;

            if (hours > 0) {
              relativeTime = `${hours.toString().padStart(2, "0")}:${minutes
                .toString()
                .padStart(2, "0")}`;
            } else {
              relativeTime = `00:${minutes.toString().padStart(2, "0")}`;
            }

            // Update previous time for next iteration
            previousTime = currentTime;
          }

          stops.push({
            stop_name: currentStop.stop_name,
            relative_stop_time: relativeTime,
            stop_code: currentStop.stop_code,
          });
        }

        // Get first and last stop names
        const firstStopName = stops.length > 0 ? stops[0].stop_name : "";
        const lastStopName =
          stops.length > 0 ? stops[stops.length - 1].stop_name : "";

        // Calculate total duration
        let duration = "00:00";
        if (stopsData.length > 1) {
          const firstTime = stopsData[0].arrival_time;
          const lastTime = stopsData[stopsData.length - 1].arrival_time;

          const firstParts = firstTime.split(":").map(Number);
          const lastParts = lastTime.split(":").map(Number);

          let firstMinutes = firstParts[0] * 60 + firstParts[1];
          let lastMinutes = lastParts[0] * 60 + lastParts[1];

          // Handle cases where the trip crosses midnight
          if (lastMinutes < firstMinutes) {
            lastMinutes += 24 * 60;
          }

          const diffMinutes = lastMinutes - firstMinutes;
          const hours = Math.floor(diffMinutes / 60);
          const minutes = diffMinutes % 60;

          duration = `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}`;
        }

        // Get schedule information - prevent duplicates
        const scheduleQuery = `
          SELECT DISTINCT
            c.sunday, c.monday, c.tuesday, c.wednesday, 
            c.thursday, c.friday, c.saturday,c.start_date, c.end_date,
            st.departure_time
          FROM trips t
          JOIN stop_times st ON t.trip_id = st.trip_id
          JOIN calendar c ON t.service_id = c.service_id
          WHERE t.route_id = ?
          AND st.stop_sequence = (
            SELECT MIN(stop_sequence)
            FROM stop_times
            WHERE trip_id = t.trip_id
          )
          ORDER BY st.departure_time
        `;

        const scheduleResults = await runQuery(scheduleQuery, [routeId]);

        // Initialize the schedule
        const schedule = {
          sunday: [] as string[],
          monday: [] as string[],
          tuesday: [] as string[],
          wednesday: [] as string[],
          thursday: [] as string[],
          friday: [] as string[],
          saturday: [] as string[],
          start_date: "",
          end_date: "",
        };

        // Helper to deduplicate times
        const addUniqueTime = (day: string[], time: string) => {
          if (!day.includes(time)) {
            day.push(time);
          }
        };

        // Process schedule results
        scheduleResults.forEach((trip) => {
          schedule.start_date = this.formatDateString(
            trip.start_date.toString()
          );
          schedule.end_date = this.formatDateString(trip.end_date.toString());
          if (trip.sunday === 1)
            addUniqueTime(schedule.sunday, trip.departure_time);
          if (trip.monday === 1)
            addUniqueTime(schedule.monday, trip.departure_time);
          if (trip.tuesday === 1)
            addUniqueTime(schedule.tuesday, trip.departure_time);
          if (trip.wednesday === 1)
            addUniqueTime(schedule.wednesday, trip.departure_time);
          if (trip.thursday === 1)
            addUniqueTime(schedule.thursday, trip.departure_time);
          if (trip.friday === 1)
            addUniqueTime(schedule.friday, trip.departure_time);
          if (trip.saturday === 1)
            addUniqueTime(schedule.saturday, trip.departure_time);
        });

        // Format route result
        const routeDetails = {
          ...routeResult,
          stops,
          first_stop_name: firstStopName,
          last_stop_name: lastStopName,
          duration,
          schedule,
        };

        resultArray.push(routeDetails);
      }

      // Send the array of results
      res.json(resultArray);
    } catch (error) {
      console.error("Error fetching line details:", error);
      res.status(500).json({
        error: "Failed to fetch line details",
        details: error,
      });
    }
  };

  formatDateString(dateStr: string) {
    if (!/^\d{8}$/.test(dateStr)) {
      throw new Error("Invalid date format. Expected 'YYYYMMDD'");
    }

    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);

    return `${day}/${month}/${year}`;
  }
}

export default new GtfsNewController();
