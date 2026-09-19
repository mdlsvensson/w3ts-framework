import { removeIfExists, writeJsonFile, loadJsonFile } from "./files.ts";
import { existsSync, copySync } from "@std/fs";
import * as path from "@std/path";
import { fromFileUrl } from "@std/path";
import luamin from "luamin";
import { IProjectConfig } from "./config.ts";
import { injectObjectData } from "./object-files.ts";
import { logger, runCommand } from "./utils.ts";
import { evaluateObjects } from "./evaluate-objects.ts";

interface TsConfig {
  compilerOptions: {
    plugins: Array<{
      transform: string;
      mapDir?: string;
      entryFile?: string;
      outputDir?: string;
    }>;
  };
  tstl: {
    luaBundle: string;
    luaBundleEntry: string;
  };
}

/** Emit an isolated config beside the source config to preserve relative paths. */
export function createBuildConfig(config: IProjectConfig): string {
  const tsconfig = loadJsonFile<TsConfig>("tsconfig.json");
  const plugin = tsconfig.compilerOptions.plugins.find((entry: { transform: string }) => entry.transform === "war3-transformer");
  if (!plugin) throw new Error("tsconfig.json is missing war3-transformer.");
  plugin.mapDir = path.resolve("maps", config.mapFolder);
  plugin.entryFile = path.resolve(tsconfig.tstl.luaBundleEntry);
  plugin.outputDir = path.resolve("dist", config.mapFolder);
  const filename = path.resolve(`tsconfig.build.${Deno.pid}.json`);
  writeJsonFile(filename, tsconfig, { spaces: 2 });
  return filename;
}

export function compileMap(config: IProjectConfig): string {
  const source = path.resolve("maps", config.mapFolder);
  const destination = path.resolve("dist", config.mapFolder);
  if (!existsSync(path.join(source, "war3map.lua"))) throw new Error(`Missing ${source}/war3map.lua. Save the base map with Lua enabled.`);

  logger.info("Evaluating Pkl object data...");
  evaluateObjects();

  // Only replace this map's staging directory, after verifying the resolved path.
  const dist = path.resolve("dist");
  if (path.dirname(destination) !== dist || destination === dist) throw new Error("Map staging path must be a direct child of dist.");
  removeIfExists(destination);
  copySync(source, destination);
  const bundle = path.resolve(loadJsonFile<TsConfig>("tsconfig.json").tstl.luaBundle);
  if (!bundle.startsWith(dist + path.SEPARATOR)) throw new Error("Lua bundle must be inside dist.");
  removeIfExists(bundle);

  const buildConfig = createBuildConfig(config);
  try {
    logger.info("Transpiling TypeScript to Lua...");
    const tstlPath = fromFileUrl(import.meta.resolve("typescript-to-lua/dist/tstl.js"));
    runCommand(Deno.execPath(), ["run", "-A", tstlPath, "-p", buildConfig]);
  } finally {
    removeIfExists(buildConfig);
  }

  logger.info("Applying Pkl object data...");
  injectObjectData(destination, loadJsonFile("src/generated/objects.json"));
  const mapLua = path.join(destination, "war3map.lua");
  let contents = Deno.readTextFileSync(mapLua) + "\n" + Deno.readTextFileSync(bundle);
  if (config.minifyScript) contents = luamin.minify(contents);
  Deno.writeTextFileSync(mapLua, contents);
  return destination;
}
