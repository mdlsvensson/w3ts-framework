import * as fs from "fs-extra";
import * as path from "path";
import { createLogger, format, transports } from "winston";

export function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return Uint8Array.from(buffer).buffer;
}

export function getFilesInDirectory(dir: string): string[] {
  return fs.readdirSync(dir).sort().flatMap(file => {
    const filename = path.join(dir, file);
    return fs.lstatSync(filename).isDirectory() ? getFilesInDirectory(filename) : [filename];
  });
}

export const logger = createLogger({
  format: format.combine(format.timestamp(), format.printf(({ level, message, timestamp }) => `[${timestamp}] ${level}: ${message}`)),
  transports: [new transports.Console(), new transports.File({ filename: "project.log" })],
});

export function runCli(action: () => void): void {
  try {
    action();
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
