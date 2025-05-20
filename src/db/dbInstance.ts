import sqlite3 from "sqlite3";
import * as dotenv from "dotenv";
dotenv.config();
class DatabaseManager {
  private static instance: sqlite3.Database | null = null;

  private constructor() {}

  public static getInstance(): sqlite3.Database {
    const dbPath =
      process.env.NODE_ENV === "production"
        ? "dist/db/gtfs.db"
        : "src/db/gtfs.db";
    if (this.instance === null) {
      this.instance = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error("Error opening database:", err);
        } else {
          console.log("database opened successfully");
          // this.loadGTFSData();
        }
      });
    }
    return this.instance;
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
