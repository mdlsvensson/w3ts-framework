import { execFileSync } from "node:child_process";
import fs from "fs-extra";
import { runCli } from "./utils.ts";

export function evaluateObjects(): void {
  fs.ensureDirSync("src/generated");
  execFileSync(Deno.env.get("PKL_EXECUTABLE") || "pkl", [
    "eval", "-f", "json", "objects/objects.pkl", "-o", "src/generated/objects.json",
  ], { stdio: "inherit" });
}

if (import.meta.main) runCli(evaluateObjects);
