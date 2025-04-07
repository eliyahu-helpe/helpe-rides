import { runQuery } from "./services/dbService";

class IndexDb {
  private async createIndexSafely(indexQuery: string): Promise<void> {
    const createHelperTable = `
      CREATE TABLE IF NOT EXISTS route_fare_lookup (
        route_short_name TEXT,
        route_long_name TEXT,
        start_stop_id TEXT,
        start_stop_name TEXT,
        end_stop_id TEXT,
        end_stop_name TEXT,
        price DECIMAL(10,2),
        currency_type TEXT,
        PRIMARY KEY (route_short_name, start_stop_id, end_stop_id)
      );
    `;

    const insertIntoHelperTable = `
      INSERT OR REPLACE INTO route_fare_lookup
      SELECT DISTINCT
        r.route_short_name,
        r.route_long_name,
        st1.stop_id as start_stop_id,
        s1.stop_name as start_stop_name,
        st2.stop_id as end_stop_id,
        s2.stop_name as end_stop_name,
        fa.price,
        fa.currency_type
      FROM stop_times st1
      JOIN stop_times st2 ON st1.trip_id = st2.trip_id
      JOIN trips t ON st1.trip_id = t.trip_id
      JOIN routes r ON t.route_id = r.route_id
      JOIN stops s1 ON st1.stop_id = s1.stop_id
      JOIN stops s2 ON st2.stop_id = s2.stop_id
      LEFT JOIN fare_rules fr ON r.route_id = fr.route_id
      LEFT JOIN fare_attributes fa ON fr.fare_id = fa.fare_id
      WHERE st2.stop_sequence > st1.stop_sequence
      GROUP BY r.route_short_name, st1.stop_id, st2.stop_id;
    `;

    try {
      // Create the helper table first
      console.log("Creating helper table...");
      await runQuery(createHelperTable);

      // Then populate it
      console.log("Populating helper table...");
      const startTime = Date.now();
      await runQuery(insertIntoHelperTable);
      const endTime = Date.now();
      console.log(
        `Helper table populated successfully in ${endTime - startTime}ms.`
      );

      // Finally create the index
      const safeQuery = indexQuery.replace(
        "CREATE INDEX",
        "CREATE INDEX IF NOT EXISTS"
      );
      console.log(`Running index creation query: ${safeQuery}`);
      await runQuery(safeQuery);
      console.log(`Successfully executed index query: ${safeQuery}`);
    } catch (error) {
      console.error(`Error during operation:`, error);
      throw error; // Re-throw to handle at caller level if needed
    }
  }

  async stopTimeIndex(): Promise<void> {
    const indexes = [
      "CREATE INDEX idx_route_fare_route_name ON route_fare_lookup(route_short_name);",
      "CREATE INDEX idx_route_fare_start_stop ON route_fare_lookup(start_stop_name);",
      "CREATE INDEX idx_route_fare_end_stop ON route_fare_lookup(end_stop_name);",
    ];

    console.log("Starting index creation/verification...");
    try {
      for (const query of indexes) {
        await this.createIndexSafely(query);
      }
      console.log("Index creation/verification completed.");
    } catch (error) {
      console.error("Error during index creation:", error);
      throw error;
    }
  }

  async indexExists(indexName: string): Promise<boolean> {
    try {
      const result = await runQuery(
        `
          SELECT name 
          FROM sqlite_master 
          WHERE type='index' AND name=?;
        `,
        [indexName]
      );

      return result.length > 0;
    } catch (error) {
      console.error(`Error checking index existence for ${indexName}:`, error);
      return false;
    }
  }
}

export const indexDb = new IndexDb();
