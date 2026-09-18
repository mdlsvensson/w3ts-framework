import { execFile } from "node:child_process";
import { loadProjectConfig } from "./config.ts";
import { compileMap } from "./compile.ts";
import { logger, runCli } from "./utils.ts";

function main(): void {
  const config = loadProjectConfig();
  const filename = compileMap(config);
  const executable = config.winePath || config.gameExecutable;
  const mapPath = config.winePath ? `Z:${filename.replace(/\//g, "\\")}` : filename;
  const args = [...(config.winePath ? [config.gameExecutable] : []), "-loadfile", mapPath, ...config.launchArgs];
  const env = { ...process.env, ...(config.winePrefix ? { WINEPREFIX: config.winePrefix } : {}) };
  logger.info(`Launching map '${filename}'...`);
  // Deno defaults windowsHide to true; Warcraft III needs a visible GUI window.
  execFile(executable, args, { env, windowsHide: false }, error => {
    if (error) {
      logger.error(`Could not launch Warcraft III: ${error.message}`);
      process.exitCode = 1;
    }
  });
}

if (import.meta.main) runCli(main);
