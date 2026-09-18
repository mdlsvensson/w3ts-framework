import * as fs from "fs-extra";
import * as path from "path";

export interface IProjectConfig {
  mapFolder: string;
  minifyScript: boolean;
  gameExecutable: string;
  outputFolder: string;
  launchArgs: string[];
  winePath?: string;
  winePrefix?: string;
}

export function loadJsonFile(filename: string): any {
  try {
    return JSON.parse(fs.readFileSync(filename, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read ${filename}: ${error}`);
  }
}

export function loadProjectConfig(root = process.cwd()): IProjectConfig {
  const filename = path.join(root, "config.json");
  const local = path.join(root, "config.local.json");
  const readConfig = (file: string) => {
    const value = loadJsonFile(file);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${file} must contain an object.`);
    return value;
  };
  const config = { ...readConfig(filename), ...(fs.existsSync(local) ? readConfig(local) : {}) };
  for (const key of ["mapFolder", "gameExecutable", "outputFolder"]) {
    if (typeof config[key] !== "string" || !config[key].trim()) throw new Error(`config.${key} must be a nonempty string.`);
  }
  if (!/^[^\\/:]+\.w3x$/i.test(config.mapFolder)) throw new Error("config.mapFolder must be a .w3x folder name, without a path.");
  if (typeof config.minifyScript !== "boolean") throw new Error("config.minifyScript must be a boolean.");
  if (!Array.isArray(config.launchArgs) || !config.launchArgs.every((arg: unknown) => typeof arg === "string")) {
    throw new Error("config.launchArgs must be an array of strings.");
  }
  for (const key of ["winePath", "winePrefix"]) {
    if (config[key] !== undefined && typeof config[key] !== "string") throw new Error(`config.${key} must be a string.`);
  }
  return config as IProjectConfig;
}
