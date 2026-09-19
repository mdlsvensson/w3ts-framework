import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import fs from "fs-extra";
import { logger } from "./utils.ts";
import { loadProjectConfig } from "./config.ts";
const War3TSTLHelper = require("war3tstlhelper");

const config = loadProjectConfig();

// Create definitions file for generated globals
const luaFile = `./maps/${config.mapFolder}/war3map.lua`;

try {
    const contents = fs.readFileSync(luaFile, "utf8");
    const parser = new War3TSTLHelper(contents);
    const result = parser.genTSDefinitions();
    fs.writeFileSync("src/war3map.d.ts", result);
} catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
    logger.error(`There was an error generating the definition file for '${luaFile}'`);
    process.exitCode = 1;
}
