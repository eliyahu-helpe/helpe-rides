import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";

class DatabaseManager {
  private static instance: sqlite3.Database | null = null;

  private constructor() {}

  public static getInstance(): sqlite3.Database {
    if (this.instance === null) {
      this.instance = new sqlite3.Database(":memory:", (err) => {
        if (err) {
          console.error("Error opening in-memory database:", err);
        } else {
          console.log("In-memory database opened successfully");
          this.loadGTFSData();
        }
      });
    }
    return this.instance;
  }

  private static loadGTFSData(): void {
    const filePath = path.resolve(__dirname, "gtfs.db");
    if (!fs.existsSync(filePath)) {
      console.error(`File database not found at ${filePath}`);
      return;
    }

    new sqlite3.Database(filePath, (err) => {
      if (err) {
        console.error("Error opening file database:", err);
        return;
      }
      console.log("File database opened successfully");
      this.instance?.exec(
        `ATTACH DATABASE '${filePath}' AS file_db`,
        (err) => {}
      );
    });
  }

  public static close(): void {
    if (this.instance) {
      this.instance.close((err) => {
        if (err) {
          console.error("Error closing database:", err);
        } else {
          console.log("Database closed successfully");
        }
      });
      this.instance = null;
    }
  }
}

export default DatabaseManager;
