# w3ts-framework

A Warcraft III map framework based on `wc3-ts-template`, with TypeScript game code and declarative Pkl object definitions.

Read the [refactor walkthrough](docs/refactor-walkthrough.md) for the build flow, module responsibilities, a custom-unit example, and a comparison with the original implementation.

## Setup

Install Deno 2.9.6 or newer within Deno 2, and the Apple Pkl CLI. From the repository root, run:

```powershell
deno install --frozen
deno task typecheck
deno task test:unit
deno task build
```

The supported workflow requires no separate Node.js or npm installation. This remains a fork of the Node-based `wc3-ts-template`: its npm libraries and TypeScript-to-Lua compiler run through Deno's Node compatibility layer. `package.json` retains dependency metadata and optional npm command aliases; `deno.json` owns task definitions and `deno.lock` locks dependency resolution. Use Deno for dependency installation.

Pkl must be on PATH, or set `PKL_EXECUTABLE` to its executable path in your terminal. For example:

```powershell
$env:PKL_EXECUTABLE = 'C:\path\to\pkl.exe'
deno task build
```

Warcraft III is required only for launching the map. Keep the unpacked base map in `maps/map.w3x` and save its script as Lua in the World Editor.

Override machine-specific settings in the ignored `config.local.json`:

```json
{
  "gameExecutable": "C:\\Games\\Warcraft III\\_retail_\\x86_64\\Warcraft III.exe"
}
```

Overrides replace top-level values from `config.json`, including the complete `launchArgs` array. Optional `winePath` and `winePrefix` configure Wine. Invalid configuration stops the command with a nonzero exit code.

## Commands

| Command | Purpose |
| --- | --- |
| `deno task build` | Evaluate Pkl, transpile Lua, inject object data, and package `dist/bin/map.w3x` |
| `deno task build -minify` | Build with Lua minification |
| `deno task test` | Build and launch the staged map in Warcraft III |
| `deno task test:unit` | Run regression tests without Pkl or Warcraft III |
| `deno task typecheck` | Check Deno scripts, then game code using the pinned TypeScript 5.8.2 compiler |
| `deno task objects:eval` | Evaluate the Pkl manifest into `src/generated/objects.json` |
| `deno task schema:gen` | Regenerate Pkl properties from dependency metadata |
| `deno task bases:gen` | Regenerate base constants and property schemas |
| `deno task build:defs` | Generate TypeScript declarations from the base map's Lua globals |
| `deno task dev` | Watch Pkl definitions and map Lua globals |

`deno task test` retains the template's game-launch behavior. Use `deno task test:unit` for automated checks.

## Authoring objects

Add definitions to `objects/definitions/*.pkl`; `objects/objects.pkl` aggregates the seven categories. For example, inside the `units` mapping in `objects/definitions/units.pkl`:

```pkl
["footman"] = new schema.RegularUnit {
  id = "u001"
  base = bases.Units.Footman
  name = "Custom Footman"
  goldCost = 100
}
```

Heroes, units, and buildings share the unit table. Items, abilities, buffs, and upgrades use their respective tables. Buffs and upgrades accept a four-character `base` rawcode. IDs must be unique across the manifest and cannot overwrite existing objects in their target table.

Nullable properties inherit the base value. Explicit `0`, `false`, `""`, and empty lists override it. List fields become comma-separated engine strings. The optional `properties` mapping overrides top-level fields using friendly or engine property names; unknown fields and reserved object IDs produce contextual errors. Buff `name` maps to `nameEditorOnly`.

Ability numeric fields such as `cooldown` and `manaCost` are scalars, matching the installed object-data library. Per-level numeric arrays are unsupported and rejected instead of being serialized as invalid strings.

## Build structure

- `src/main.ts`: game runtime and compile-time version constants.
- `scripts/config.ts`: configuration loading, local overrides, and validation.
- `scripts/compile.ts`: Pkl evaluation, isolated compiler configuration, Lua compilation, and object injection.
- `scripts/object-data.ts`: manifest validation and category-aware property normalization, shared with schema generation.
- `scripts/object-files.ts`: binary table loading and saving, including buff/upgrade and skin tables omitted by the transformer.
- `scripts/build.ts`: archive packaging; `scripts/test.ts`: game launch.
- `objects/schema/`: authoring types and generated engine properties.

Deno build code uses `deno.json` and stays outside the Lua source tree. Builds evaluate Pkl once and write an ignored `tsconfig.build.<pid>.json`, removed after transpilation. Tracked `tsconfig.json` remains portable. Object injection runs after the transformer so its output is preserved.

`scripts/warcraft-library.ts` adapts the upstream library's CommonJS constructor exports. `scripts/watch.ts` replaces `npm-watch` using Deno file events. The compiler subprocess runs with `Deno.execPath()`; it does not launch Node. Build tasks use `-A` because the template's compiler, compile-time callbacks, file generators, and game launcher need filesystem and process access.

See the [Deno migration notes](docs/deno-migration.md) for compatibility decisions and the verified migration path.

Tests cover property normalization, inheritance, invalid manifests, ID collisions, binary round trips for all categories, file persistence, configuration overrides, and compiler configuration isolation. Full build validation additionally requires Pkl; gameplay validation requires Warcraft III.
