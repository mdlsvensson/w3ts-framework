import { execFileSync } from "child_process";
import * as fs from "fs-extra";
import * as path from "path";
import { IProjectConfig, loadJsonFile } from "./config";
import { injectObjectData } from "./object-files";
import { logger } from "./utils";
const luamin = require("luamin");

/** Emit an isolated config beside the source config to preserve relative paths. */
export function createBuildConfig(config: IProjectConfig): string {
  const tsconfig = loadJsonFile("tsconfig.json");
  const plugin = tsconfig.compilerOptions.plugins.find((entry: { transform: string }) => entry.transform === "war3-transformer");
  if (!plugin) throw new Error("tsconfig.json is missing war3-transformer.");
  plugin.mapDir = path.resolve("maps", config.mapFolder);
  plugin.entryFile = path.resolve(tsconfig.tstl.luaBundleEntry);
  plugin.outputDir = path.resolve("dist", config.mapFolder);
  const filename = path.resolve(`tsconfig.build.${process.pid}.json`);
  fs.writeJsonSync(filename, tsconfig, { spaces: 2 });
  return filename;
}

export function compileMap(config: IProjectConfig): string {
  const source = path.resolve("maps", config.mapFolder);
  const destination = path.resolve("dist", config.mapFolder);
  if (!fs.existsSync(path.join(source, "war3map.lua"))) throw new Error(`Missing ${source}/war3map.lua. Save the base map with Lua enabled.`);

  logger.info("Evaluating Pkl object data...");
  fs.ensureDirSync("src/generated");
  execFileSync("pkl", ["eval", "-f", "json", "objects/objects.pkl", "-o", "src/generated/objects.json"], { stdio: "inherit" });

  // Only replace this map's staging directory, after verifying the resolved path.
  const dist = path.resolve("dist");
  if (path.dirname(destination) !== dist || destination === dist) throw new Error("Map staging path must be a direct child of dist.");
  fs.removeSync(destination);
  fs.copySync(source, destination);
  const bundle = path.resolve(loadJsonFile("tsconfig.json").tstl.luaBundle);
  if (!bundle.startsWith(dist + path.sep)) throw new Error("Lua bundle must be inside dist.");
  fs.removeSync(bundle);

  const buildConfig = createBuildConfig(config);
  try {
    logger.info("Transpiling TypeScript to Lua...");
    execFileSync(process.execPath, [require.resolve("typescript-to-lua/dist/tstl.js"), "-p", buildConfig], { stdio: "inherit" });
  } finally {
    fs.removeSync(buildConfig);
  }

  logger.info("Applying Pkl object data...");
  injectObjectData(destination, loadJsonFile("src/generated/objects.json"));
  const mapLua = path.join(destination, "war3map.lua");
  let contents = fs.readFileSync(mapLua, "utf8") + "\n" + fs.readFileSync(bundle, "utf8");
  if (config.minifyScript) contents = luamin.minify(contents);
  fs.writeFileSync(mapLua, contents);
  return destination;
}
