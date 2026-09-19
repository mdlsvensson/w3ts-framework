import * as path from "node:path";
import { War3Map } from "./warcraft-library.ts";
import { getFilesInDirectory, logger, toArrayBuffer, runCli } from "./utils.ts";
import { loadProjectConfig } from "./config.ts";
import { compileMap } from "./compile.ts";

function main() {
  const config = loadProjectConfig();
  const minify = Deno.args.includes("-minify") || config.minifyScript;

  if (minify !== config.minifyScript) {
    logger.info('Enabling minification from command line argument "-minify".');
    config.minifyScript = minify;
  }
  const mapDir = compileMap(config);

  logger.info(`Creating w3x archive...`);
  Deno.mkdirSync(config.outputFolder, { recursive: true });
  createMapFromDir(path.join(config.outputFolder, config.mapFolder), mapDir);
}

/**
 * Creates a w3x archive from a directory
 * @param output The output filename
 * @param dir The directory to create the archive from
 */
export function createMapFromDir(output: string, dir: string) {
  const map = new War3Map();
  const files = getFilesInDirectory(dir);

  map.archive.resizeHashtable(files.length);

  for (const fileName of files) {
    const contents = toArrayBuffer(Deno.readFileSync(fileName));
    const archivePath = path.relative(dir, fileName).replace(/\\/g, "/");
    const imported = map.import(archivePath, contents);

    if (!imported) {
      throw new Error("Failed to import " + archivePath);
    }
  }

  const result = map.save();

  if (!result) {
    throw new Error("Failed to save archive.");
  }

  Deno.writeFileSync(output, new Uint8Array(result));

  logger.info("Finished!");
}

if (import.meta.main) runCli(main);
