import { runCli, runCommand } from "./utils.ts";

export function evaluateObjects(): void {
  Deno.mkdirSync("src/generated", { recursive: true });
  runCommand(Deno.env.get("PKL_EXECUTABLE") || "pkl", [
    "eval", "-f", "json", "objects/objects.pkl", "-o", "src/generated/objects.json",
  ]);
}

if (import.meta.main) runCli(evaluateObjects);
