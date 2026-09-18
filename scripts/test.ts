import { execFile } from "child_process";
import { loadProjectConfig } from "./config";
import { compileMap } from "./compile";
import { logger, runCli } from "./utils";

function main(): void {
  const config = loadProjectConfig();
  const filename = compileMap(config);
  const executable = config.winePath || config.gameExecutable;
  const mapPath = config.winePath ? `Z:${filename.replace(/\//g, "\\")}` : filename;
  const args = [...(config.winePath ? [config.gameExecutable] : []), "-loadfile", mapPath, ...config.launchArgs];
  const env = { ...process.env, ...(config.winePrefix ? { WINEPREFIX: config.winePrefix } : {}) };
  logger.info(`Launching map '${filename}'...`);
  execFile(executable, args, { env }, error => {
    if (error) {
      logger.error(`Could not launch Warcraft III: ${error.message}`);
      process.exitCode = 1;
    }
  });
}

if (require.main === module) runCli(main);
