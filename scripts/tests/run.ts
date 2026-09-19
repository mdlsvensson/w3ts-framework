import assert from "node:assert/strict";
const test = Deno.test;
import fs from "fs-extra";
import * as os from "node:os";
import * as path from "node:path";
import { ObjectData } from "war3-objectdata-th";
import { SimpleFile, LevelFile } from "../warcraft-library.ts";
import { applyObjectData } from "../object-data.ts";
import { injectObjectData } from "../object-files.ts";
import { loadProjectConfig } from "../config.ts";
import { createBuildConfig } from "../compile.ts";
import { plugin as wcraftLintPlugin } from "../lint/wcraft-rules.ts";
import { validateJsonSyntax, validateProjectJsonFiles } from "../validate-json.ts";

test("unit aliases, null inheritance, lists and explicit property overrides", () => {
  const data = new ObjectData();
  const originalName = data.units.get("hfoo")!.name;
  applyObjectData(data, { units: { u001: {
    base: "hfoo", name: null, goldCost: 99, abilities: [], movementType: "foot",
    properties: { goldCost: 0, lumberCost: null },
  } } });
  const unit = data.units.get("u001")!;
  assert.equal(unit.name, originalName);
  assert.equal(unit.goldCostundefined, 0);
  assert.equal(unit.normal, "");
  assert.equal(unit.type, "foot");
  assert.equal(unit.lumberCostundefined, data.units.get("hfoo")!.lumberCostundefined);
});

test("items use item field names and preserve false values", () => {
  const data = new ObjectData();
  applyObjectData(data, { items: { sword: {
    id: "I001", base: "ratf", goldCost: 0, perishable: false,
    tintingColorRed: 80, abilities: ["AInv"],
  } } });
  const item = data.items.get("I001")!;
  assert.equal(item.goldCost, 0);
  assert.equal(item.perishable, false);
  assert.equal(item.tintingColor1Red, 80);
  assert.equal(item.abilities, "AInv");
});

test("all seven categories survive binary serialization and reloading", () => {
  const data = new ObjectData();
  applyObjectData(data, {
    heroes: { H001: { base: "Hpal", name: "Test hero" } },
    units: { u001: { base: "hfoo", name: "Test unit" } },
    buildings: { b001: { base: "hbar", name: "Test building" } },
    items: { I001: { base: "ratf", name: "Test item" } },
    abilities: { A001: { base: "AHhb", name: "Test ability" } },
    buffs: { B001: { base: "BHbz", name: "Test buff" } },
    upgrades: { R001: { base: "Rhme", name: "Test upgrade", upgradeClass: "armor" } },
  });
  const saved = data.save();
  const restored = new ObjectData();
  const parsed = Object.fromEntries(Object.entries(saved).map(([key, file]) => {
    const parser = /w3[daq]/.test(key) ? new LevelFile() : new SimpleFile();
    parser.load(file.save());
    return [key, parser];
  }));
  restored.load(parsed);
  for (const [container, id, name] of [
    [restored.units, "H001", "Test hero"], [restored.units, "u001", "Test unit"],
    [restored.units, "b001", "Test building"], [restored.items, "I001", "Test item"],
    [restored.abilities, "A001", "Test ability"],
    [restored.upgrades, "R001", "Test upgrade"],
  ] as const) assert.equal(container.get(id)!.name, name);
  assert.equal(restored.buffs.get("B001")!.nameEditorOnly, "Test buff");
  assert.equal(restored.upgrades.get("R001")!.class, "armor");
});

test("invalid manifests fail before creating custom objects", () => {
  for (const invalid of [
    { buildings: { u001: { base: "hbar" } } },
    { items: { I001: { base: "xxxx" } } },
    { items: { I001: { base: "ratf", goldCots: 1 } } },
    { items: { I001: { base: "ratf", properties: { newId: "I002" } } } },
    { abilities: { A001: { base: "AHhb", cooldown: [1, 2, 3] } } },
    { items: { "bad!": { base: "ratf" } } },
    { items: [] }, { typo: {} },
  ]) {
    const data = new ObjectData();
    assert.throws(() => applyObjectData(data, { units: { u001: { base: "hfoo", name: "Valid" } }, ...invalid }));
    assert.equal(data.units.has("u001"), false);
  }
});

test("existing game and map IDs cannot be silently overwritten", () => {
  const data = new ObjectData();
  assert.throws(() => applyObjectData(data, { units: { hfoo: { base: "hbar" } } }), /already exists/);
  data.units.copy("hfoo", "u001");
  assert.throws(() => applyObjectData(data, { units: { u001: { base: "hbar" } } }), /already exists/);
});

test("file injection writes buffs/upgrades and preserves existing modifications", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "w3ts-object-tests-"));
  try {
    injectObjectData(dir, { buffs: { B001: { base: "BHbz", name: "Existing" } } });
    injectObjectData(dir, { upgrades: { R001: { base: "Rhme", name: "New upgrade", goldBase: 42 } } });
    const buff = new SimpleFile();
    buff.load(fs.readFileSync(path.join(dir, "war3mapSkin.w3h")));
    assert.equal(buff.customTable.objects[0].newId, "B001");
    const upgrade = new LevelFile();
    upgrade.load(fs.readFileSync(path.join(dir, "war3map.w3q")));
    assert.equal(upgrade.customTable.objects[0].newId, "R001");
    assert(upgrade.customTable.objects[0].modifications.some(mod => mod.id === "gglb" && mod.value === 42));
  } finally {
    fs.removeSync(dir);
  }
});

test("config overrides are validated and malformed JSON fails clearly", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "w3ts-config-tests-"));
  const config = { mapFolder: "map.w3x", minifyScript: false, gameExecutable: "game.exe", outputFolder: "dist/bin", launchArgs: [] };
  try {
    fs.writeJsonSync(path.join(dir, "config.json"), config);
    fs.writeJsonSync(path.join(dir, "config.local.json"), { gameExecutable: "Local Game.exe", launchArgs: ["-windowed"] });
    assert.deepEqual(loadProjectConfig(dir), { ...config, gameExecutable: "Local Game.exe", launchArgs: ["-windowed"] });
    fs.writeJsonSync(path.join(dir, "config.local.json"), { mapFolder: "../map.w3x" });
    assert.throws(() => loadProjectConfig(dir), /mapFolder/);
    fs.writeFileSync(path.join(dir, "config.local.json"), "{");
    assert.throws(() => loadProjectConfig(dir), /Cannot read.*config.local.json/);
  } finally {
    fs.removeSync(dir);
  }
});

test("build config does not modify tracked tsconfig", () => {
  const before = fs.readFileSync("tsconfig.json", "utf8");
  const filename = createBuildConfig(loadProjectConfig());
  try {
    assert.equal(fs.readFileSync("tsconfig.json", "utf8"), before);
    const generated = fs.readJsonSync(filename);
    assert(path.isAbsolute(generated.compilerOptions.plugins[0].mapDir));
  } finally {
    fs.removeSync(filename);
  }
});

test("custom lint plugin wcraft-rules catches invalid FourCC rawcodes", () => {
  const runLint = (code: string) => {
    const denoLint = (Deno as unknown as {
      lint?: {
        runPlugin: (plugin: unknown, filename: string, source: string) => Array<{ message: string; id: string }>;
      };
    }).lint;
    assert(denoLint, "Deno.lint is required for lint plugin tests");
    return denoLint.runPlugin(wcraftLintPlugin, "src/test.ts", code);
  };

  // Valid rawcodes
  assert.equal(runLint('FourCC("hfoo");').length, 0);
  assert.equal(runLint('FourCC("A000");').length, 0);
  assert.equal(runLint('FourCC(Units.Footman);').length, 0);

  // Invalid length (> 4)
  const tooLong = runLint('FourCC("hfoo1");');
  assert.equal(tooLong.length, 1);
  assert.match(tooLong[0].message, /must be exactly 4 characters/);

  // Invalid length (< 4)
  const tooShort = runLint('FourCC("hfo");');
  assert.equal(tooShort.length, 1);
  assert.match(tooShort[0].message, /must be exactly 4 characters/);

  // Invalid non-printable ASCII
  const nonAscii = runLint('FourCC("hf\\x00o");');
  assert.equal(nonAscii.length, 1);
  assert.match(nonAscii[0].message, /printable ASCII/);
});

test("validateJsonSyntax detects valid and corrupted JSON files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "w3ts-json-tests-"));
  try {
    const validFile = path.join(dir, "valid.json");
    const invalidFile = path.join(dir, "invalid.json");
    fs.writeJsonSync(validFile, { key: "value" });
    fs.writeFileSync(invalidFile, "{ not valid json ");

    assert.equal(validateJsonSyntax(validFile).valid, true);
    const invalidResult = validateJsonSyntax(invalidFile);
    assert.equal(invalidResult.valid, false);
    assert(invalidResult.error);

    const projectResults = validateProjectJsonFiles();
    assert(projectResults.length >= 4);
    assert(projectResults.every(r => r.valid));
  } finally {
    fs.removeSync(dir);
  }
});

