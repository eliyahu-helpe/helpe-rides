import { Request, Response } from "express";
import DatabaseManager from "../db/dbInstance";
import { runQuery } from "../services/dbService";

import {
  LineDetailsResponse,
  Route,
  Schedule,
  StopTime,
  StopTimeJoinResult,
  Trip,
} from "rides.interface";

class GtfsController {
  private options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  };
  private optionsDays: Intl.DateTimeFormatOptions = {
    weekday: "long",
    timeZone: "Asia/Jerusalem",
  };

  getCurrentDay() {
    const israelDay = new Intl.DateTimeFormat("en-GB", this.optionsDays).format(
      new Date()
    );
    return israelDay;
  }

  getLineDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const { lineId, agentId, city, addSchedule, routeLongName } = req.body;
      const start = process.hrtime();

      // Parse arrays from semicolon-separated strings
      const parsedLongNames = routeLongName?.split(";").filter(Boolean) ?? [];
      const parsedLineIds = lineId?.split(";").filter(Boolean) ?? [];

      // Get routes with the modified query to handle arrays
      const routes = await this.getRoutes(
        parsedLineIds,
        parsedLongNames,
        agentId
      );

      if (!routes.length) {
        res.status(404).json({ error: "No routes found" });
        return;
      }

      const trips = await this.getTripsForRoutes(routes);

      if (!trips.length) {
        res.status(404).json({ error: "No trips found" });
        return;
      }

      const stopTimeDetails = await this.getStopTimeDetails(
        trips,
        parsedLineIds,
        city
      );

      const object = this.transformStopTimeData(stopTimeDetails);
      if (addSchedule) {
        for (const tripId in object) {
          const schedule = await this.getSchedule(object[tripId].route_id);
          object[tripId].schedule = schedule;
        }
      }

      const array = Object.values(object);
      array.forEach((normalize) => {
        normalize.stops = this.calculateRelativeStopTimes(normalize.stops);
      });

      const end = process.hrtime(start);
      const executionTime = end[0] * 1000 + end[1] / 1000000;
      console.log(`Execution time: ${executionTime} ms`);

      res.json(array);
    } catch (error) {
      console.error("Error in getLineDetails:", error);
      res
        .status(500)
        .json({ error: "An error occurred while fetching line details" });
    }
  };

  getStopIdDetails = async (req: Request, res: Response) => {
    const {
      oneOfNextStopLike,
      currentStopId,
      currentStopDescroptionLike,
      agencyName,
      limit,
      routeShortName,
    } = req.body;

    if (
      !oneOfNextStopLike &&
      !currentStopId &&
      !currentStopDescroptionLike &&
      !agencyName &&
      !routeShortName
    ) {
      res.status(400).json({ error: "bad request" });
      return;
    }

    const israelTime = new Intl.DateTimeFormat("en-GB", this.options).format(
      new Date()
    );

    try {
      let query = `
        WITH relevant_stops AS (
          SELECT st.trip_id, st.stop_id, st.stop_sequence, st.arrival_time
          FROM stop_times st
          WHERE st.arrival_time > '${israelTime}'
          ${currentStopId ? `AND st.stop_id = '${currentStopId}'` : ""}
          ORDER BY st.arrival_time
          LIMIT 10000
        )`;

      if (oneOfNextStopLike) {
        query += `
        , valid_trips AS (
          SELECT DISTINCT t1.trip_id
          FROM relevant_stops t1
          JOIN stop_times t2 ON t1.trip_id = t2.trip_id
          JOIN stops s ON t2.stop_id = s.stop_id
          WHERE s.stop_name LIKE '%${oneOfNextStopLike}%'
          ${currentStopId ? "AND t2.stop_sequence > t1.stop_sequence" : ""}
        )`;
      }

      if (routeShortName || agencyName) {
        query += `
        , filtered_trips AS (
          SELECT t.trip_id
          FROM trips t
          JOIN routes r ON t.route_id = r.route_id
          ${agencyName ? "JOIN agency a ON r.agency_id = a.agency_id" : ""}
          WHERE 1=1
          ${routeShortName ? `AND r.route_short_name = ${routeShortName}` : ""}
          ${agencyName ? `AND a.agency_name LIKE '%${agencyName}%'` : ""}
        )`;
      }

      query += `
        SELECT 
          rs.trip_id,
          r.route_id,
          r.route_long_name,
          r.route_short_name,
          a.agency_name,
          a.agency_id,
          s.stop_name,
          rs.arrival_time,
          rs.stop_id,
          c.sunday,
          c.monday,
          c.tuesday,
          c.thursday,
          c.wednesday,
          c.friday,
          c.saturday,
          s.stop_desc,
          rs.stop_sequence
        FROM relevant_stops rs
        JOIN trips t ON rs.trip_id = t.trip_id
        JOIN routes r ON t.route_id = r.route_id
        JOIN agency a ON r.agency_id = a.agency_id
        JOIN stops s ON rs.stop_id = s.stop_id
        JOIN calendar c ON t.service_id = c.service_id
        WHERE c."${this.getCurrentDay()}" = 1
        ${
          oneOfNextStopLike
            ? "AND rs.trip_id IN (SELECT trip_id FROM valid_trips)"
            : ""
        }
        ${
          routeShortName || agencyName
            ? "AND rs.trip_id IN (SELECT trip_id FROM filtered_trips)"
            : ""
        }
        ${
          currentStopDescroptionLike
            ? `AND s.stop_desc LIKE '%${currentStopDescroptionLike}%'`
            : ""
        }
        ORDER BY rs.arrival_time, rs.trip_id, rs.stop_sequence
      `;

      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      const results = await runQuery(query);
      res.send(results);
    } catch (error) {
      console.error("Query error:", error);
      res.status(500).send({ error: "An error occurred while fetching data." });
    }
  };

  private async getRoutes(
    lineIds: string[],
    routeLongNames: string[],
    agentId?: number
  ): Promise<Route[]> {
    let conditions = [];
    let params = [];

    if (lineIds.length > 0) {
      const lineIdPlaceholders = lineIds
        .map(() => "?")
        .join(" OR route_short_name = ");
      conditions.push(`(route_short_name = ${lineIdPlaceholders})`);
      params.push(...lineIds);
    }

    if (routeLongNames.length > 0) {
      const longNamePlaceholders = routeLongNames
        .map(() => "?")
        .join(" OR route_long_name = ");
      conditions.push(`(route_long_name = ${longNamePlaceholders})`);
      params.push(...routeLongNames);
    }

    if (agentId) {
      conditions.push("agency_id = ?");
      params.push(agentId);
    }

    const whereClause =
      conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const query = `
      SELECT * FROM routes 
      ${whereClause}
    `;

    const results = await runQuery(query, params);
    return results as Route[];
  }

  private async getTripsForRoutes(routes: Route[]): Promise<Trip[]> {
    const trips: Trip[] = [];
    for (const route of routes) {
      const routeTrips = await runQuery(
        "SELECT * FROM trips WHERE route_id = ?",
        [route.route_id]
      );
      if (routeTrips[0]) {
        trips.push(routeTrips[0] as Trip);
      }
    }
    return trips;
  }

  private async getStopTimeDetails(
    trips: Trip[],
    lineIds: string[],
    city?: string
  ): Promise<StopTimeJoinResult[][]> {
    const stopTimeQueries = trips.map(async (trip) => {
      let whereConditions = ["t.trip_id = ?"];
      let params = [trip.trip_id];

      // Only add route_short_name conditions if lineIds array is not empty
      if (lineIds.length > 0) {
        const lineIdConditions = lineIds
          .map(() => "r.route_short_name = ?")
          .join(" OR ");
        whereConditions.push(`(${lineIdConditions})`);
        params.push(...lineIds);
      }

      // Add city condition if provided
      if (city) {
        whereConditions.push("s.stop_desc LIKE ?");
        params.push(`%${city}%`);
      }

      const query = `
        SELECT 
          t.trip_id,
          r.route_id,
          r.route_long_name,
          r.route_short_name,
          st.arrival_time,
          s.stop_name,
          s.stop_desc,
          a.agency_name,
          a.agency_id
        FROM stop_times AS st
        LEFT JOIN trips t ON st.trip_id = t.trip_id
        LEFT JOIN routes r ON r.route_id = t.route_id
        LEFT JOIN stops s ON s.stop_id = st.stop_id
        LEFT JOIN agency a ON r.agency_id = a.agency_id
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY st.stop_sequence
      `;

      const results = await runQuery(query, params);
      return results as StopTimeJoinResult[];
    });

    return Promise.all(stopTimeQueries);
  }

  private transformStopTimeData(
    stopTimeData: StopTimeJoinResult[][]
  ): LineDetailsResponse {
    const response: LineDetailsResponse = {};

    stopTimeData.forEach((tripStops) => {
      if (tripStops.length === 0) return;

      const firstStop = tripStops[0];
      const lastStop = tripStops[tripStops.length - 1];

      tripStops.forEach((stop) => {
        const {
          trip_id,
          route_id,
          route_long_name,
          arrival_time,
          stop_name,
          agency_name,
          agency_id,
          route_short_name,
        } = stop;

        if (!response[trip_id]) {
          response[trip_id] = {
            stops: [],
            long_name: route_long_name,
            duration: this.calculateDuration({
              first_stop: firstStop.arrival_time,
              last_stop: lastStop.arrival_time,
            }),
            route_id: route_id,
            route_short_name: route_short_name,
            first_stop_name: firstStop.stop_name,
            last_stop_name: lastStop.stop_name,
            agency_name: agency_name,
            agency_id: agency_id,
            schedule: {
              sunday: [],
              monday: [],
              tuesday: [],
              wednesday: [],
              thursday: [],
              friday: [],
              saturday: [],
            },
          };
        }

        response[trip_id].stops.push({
          stop_name: stop_name,
          relative_stop_time: arrival_time,
        });
      });
    });

    return response;
  }

  private calculateRelativeStopTimes(stops: StopTime[]) {
    const timeToSeconds = (time: string) => {
      const [hours, minutes, seconds] = time.split(":").map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    };

    const secondsToTime = (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
    };

    const startTimeInSeconds = timeToSeconds(stops[0].relative_stop_time);

    return stops.map((stop: StopTime) => {
      const stopTimeInSeconds = timeToSeconds(stop.relative_stop_time);
      const relativeTimeInSeconds = stopTimeInSeconds - startTimeInSeconds;
      const relativeTime = secondsToTime(relativeTimeInSeconds);

      return {
        ...stop,
        relative_stop_time: relativeTime,
      };
    });
  }

  private calculateDuration(stopsObject: {
    first_stop: string;
    last_stop: string;
  }) {
    const { first_stop, last_stop } = stopsObject;

    const [firstHours, firstMinutes, firstSeconds] = first_stop
      .split(":")
      .map(Number);
    const [lastHours, lastMinutes, lastSeconds] = last_stop
      .split(":")
      .map(Number);

    const firstDate = new Date();
    const lastDate = new Date();

    firstDate.setHours(firstHours, firstMinutes, firstSeconds);
    lastDate.setHours(lastHours, lastMinutes, lastSeconds);

    const durationMs = lastDate.getTime() - firstDate.getTime();

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  }
  private async getSchedule(routeId: string): Promise<Schedule> {
    const query = `
      SELECT st.arrival_time, c.sunday, c.monday, c.tuesday, 
             c.wednesday, c.thursday, c.friday, c.saturday
      FROM trips t
      LEFT JOIN stop_times st ON st.trip_id = t.trip_id
      INNER JOIN calendar c ON t.service_id = c.service_id
      AND st.stop_sequence = 1
      WHERE route_id = ?
      ORDER BY st.arrival_time
    `;

    const results = await runQuery(query, [routeId]);
    const schedule: Schedule = {
      sunday: [],
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
    };
    results.forEach((row: any) => {
      const {
        arrival_time,
        sunday,
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
      } = row;

      if (sunday === 1) schedule.sunday.push(arrival_time);
      if (monday === 1) schedule.monday.push(arrival_time);
      if (tuesday === 1) schedule.tuesday.push(arrival_time);
      if (wednesday === 1) schedule.wednesday.push(arrival_time);
      if (thursday === 1) schedule.thursday.push(arrival_time);
      if (friday === 1) schedule.friday.push(arrival_time);
      if (saturday === 1) schedule.saturday.push(arrival_time);
    });

    return schedule;
  }

  getPrice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { start_stop_name, end_stop_name, route_short_name } = req.body;

      if (!start_stop_name || !end_stop_name) {
        res.status(400).json({ error: "Stop names required" });
        return;
      }

      let whereConditions = [
        "start_stop_name LIKE ?",
        "end_stop_name LIKE ?",
        "route_short_name is not null",
        "price is not null",
      ];
      let params = [`%${start_stop_name}%`, `%${end_stop_name}%`];

      // Only add route_short_name condition if it's provided
      if (route_short_name) {
        whereConditions.unshift("route_short_name = ?");
        params.unshift(route_short_name);
      }

      const query = `
        SELECT * 
        FROM route_fare_lookup
        WHERE ${whereConditions.join(" AND ")}
        LIMIT 1
      `;

      const results = await runQuery(query, params);

      if (results.length === 0) {
        res.status(404).json({ error: "No route found" });
      } else {
        res.json(results[0]);
      }
    } catch (error) {
      console.error("Route details error:", error);
      res.status(500).json({ error: "Failed to fetch route details" });
    }
  };
}

export const gtfsController = new GtfsController();
