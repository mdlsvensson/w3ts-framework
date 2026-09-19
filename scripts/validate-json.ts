import fs from "fs-extra";
import * as path from "node:path";
import { loadProjectConfig } from "./config.ts";

export interface ValidationResult {
  file: string;
  valid: boolean;
  error?: string;
}

export function validateJsonSyntax(filePath: string): ValidationResult {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    JSON.parse(content);
    return { file: filePath, valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { file: filePath, valid: false, error: message };
  }
}

export function validateProjectJsonFiles(rootDir = process.cwd()): ValidationResult[] {
  const filesToCheck = [
    "config.json",
    "deno.json",
    "package.json",
    "tsconfig.json",
  ];

  const localConfig = path.join(rootDir, "config.local.json");
  if (fs.existsSync(localConfig)) {
    filesToCheck.push("config.local.json");
  }

  const results: ValidationResult[] = [];
  for (const relativePath of filesToCheck) {
    const fullPath = path.join(rootDir, relativePath);
    if (fs.existsSync(fullPath)) {
      results.push(validateJsonSyntax(fullPath));
    }
  }

  return results;
}

export function runValidation(rootDir = process.cwd()): boolean {
  console.log("Validating JSON configuration files...");
  const jsonResults = validateProjectJsonFiles(rootDir);
  let hasErrors = false;

  for (const result of jsonResults) {
    if (result.valid) {
      console.log(`  [OK] ${path.relative(rootDir, result.file)}`);
    } else {
      console.error(`  [FAIL] ${path.relative(rootDir, result.file)}: ${result.error}`);
      hasErrors = true;
    }
  }

  console.log("Validating project configuration schema (config.json / config.local.json)...");
  try {
    const config = loadProjectConfig(rootDir);
    console.log(`  [OK] Project config valid (mapFolder: "${config.mapFolder}", executable: "${config.gameExecutable}")`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  [FAIL] Configuration schema error: ${message}`);
    hasErrors = true;
  }

  return !hasErrors;
}

if (import.meta.main) {
  const success = runValidation();
  if (!success) {
    Deno.exit(1);
  }
}
