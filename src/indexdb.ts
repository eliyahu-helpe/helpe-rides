import { runQuery } from "./services/dbService";

class IndexDb {
  private async createIndexSafely(indexQuery: string): Promise<void> {
    // Add IF NOT EXISTS to prevent errors with existing indexes
    const safeQuery = indexQuery.replace(
      "CREATE INDEX",
      "CREATE INDEX IF NOT EXISTS"
    );

    try {
      await runQuery(safeQuery);
      console.log(`Successfully executed: ${safeQuery}`);
    } catch (error) {
      // Log error but don't throw, allowing other operations to continue
      console.log(
        `Warning: Index creation failed, but continuing. Details:`,
        error
      );
    }
  }

  async stopTimeIndex(): Promise<void> {
    const indexes = [
      "CREATE INDEX idx_stop_times_arrival_composite ON stop_times(arrival_time, trip_id, stop_sequence);",
      "CREATE INDEX idx_trips_route ON trips(route_id, trip_id);",
      "CREATE INDEX idx_stops_name_composite ON stops(stop_name, stop_id);",
      "CREATE INDEX idx_routes_agency ON routes(agency_id, route_short_name);",
    ];

    console.log("Starting index creation/verification...");

    // Execute all index creations in parallel for better performance
    await Promise.all(indexes.map((query) => this.createIndexSafely(query)));

    console.log("Index creation/verification completed");
  }

  // Optional: Method to check if an index exists
  async indexExists(indexName: string): Promise<boolean> {
    try {
      const result = await runQuery(
        `
        SELECT name 
        FROM sqlite_master 
        WHERE type='index' AND name=?
      `,
        [indexName]
      );

      return result.length > 0;
    } catch (error) {
      console.log(`Error checking index existence: ${error}`);
      return false;
    }
  }
}

export const indexDb = new IndexDb();
