import DatabaseManager from "../db/dbInstance";

export function runQuery(query: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const db = DatabaseManager.getInstance();
    const result: any[] = [];

    // console.log("Starting query execution...");

    db.serialize(() => {
      const stmt = db.prepare(query);

      stmt.each(
        params,
        (err: Error | null, row: any) => {
          if (err) {
            console.error("Error during query execution:", err);
            reject(err);
            return;
          }
          result.push(row);
        },
        (err: Error | null, count: number) => {
          if (err) {
            console.error("Error finalizing query:", err);
            reject(err);
            return;
          }
          // console.log(`Query completed. ${count} rows processed.`);
          resolve(result);
        }
      );

      stmt.finalize();
    });
  });
}
