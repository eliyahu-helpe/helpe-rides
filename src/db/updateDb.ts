import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import AdmZip from "adm-zip";
import { exec } from "node:child_process";
import https from "https";

// Replace with the actual URL
const outputDir: string = path.join(__dirname, "files");
const dbPath: string = path.join(__dirname, "gtfs.db");
const requiredFiles: Set<string> = new Set([
  "agency.txt",
  "calendar.txt",
  "fare_attributes.txt",
  "fare_rules.txt",
  "routes.txt",
  "shapes.txt",
  "stop_times.txt",
  "stops.txt",
  "trips.txt",
]);

export async function downloadAndExtractGTFS(
  gtfsZipUrl: string
): Promise<boolean> {
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    console.log("Downloading GTFS zip file...");
    const response = await axios({
      httpsAgent: agent,
      method: "get",
      url: gtfsZipUrl,
      responseType: "arraybuffer",
    });
    const zipFilePath: string = path.join(__dirname, "gtfs.zip");
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(zipFilePath, Buffer.from(response.data));
    console.log("GTFS zip file downloaded.");

    console.log("Extracting required files...");
    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();

    // Clear existing files in the output directory
    const existingFiles = await fs.readdir(outputDir);
    for (const file of existingFiles) {
      await fs.unlink(path.join(outputDir, file));
    }

    for (const entry of zipEntries) {
      if (requiredFiles.has(entry.entryName.toLowerCase())) {
        await new Promise<void>((resolve, reject) => {
          zip.extractEntryTo(entry.entryName, outputDir, false);
          resolve();
        });
        console.log(`Extracted: ${entry.entryName}`);
      }
    }
    await fs.unlink(zipFilePath); // Remove the zip file
    console.log("Required files extracted.");
    return true;
  } catch (error) {
    console.error("Error downloading or extracting GTFS:", error);
    return false;
  }
}

export async function runGTFSImport(): Promise<void> {
  console.log("Running gtfs-import command...");
  return new Promise((resolve, reject) => {
    const command = `npx gtfs-import --gtfsPath "${outputDir}" --sqlitePath "${dbPath}"`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error during gtfs-import: ${error}`);
        reject(error);
        return;
      }
      console.log(`gtfs-import output:\n${stdout}`);
      if (stderr) {
        console.error(`gtfs-import stderr:\n${stderr}`);
      }
      console.log("GTFS import complete.");
      resolve();
    });
  });
}

// async function main(): Promise<void> {
//   if (await downloadAndExtractGTFS()) {
//     await runGTFSImport();
//     console.log("GTFS update process finished.");
//   } else {
//     console.error("GTFS update process failed.");
//   }
// }

// main();
