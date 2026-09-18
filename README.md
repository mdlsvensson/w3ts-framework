# w3ts-framework

A Warcraft III map framework based on `wc3-ts-template`, with TypeScript game code and declarative Pkl object definitions.

Read the [refactor walkthrough](docs/refactor-walkthrough.md) for the build flow, module responsibilities, a custom-unit example, and a comparison with the original implementation.

## Setup

Install Node.js/npm and the Apple Pkl CLI (`pkl` must be on PATH), then run `npm ci` from the repository root. Warcraft III is required only for launching the map. Keep the unpacked base map in `maps/map.w3x` and save its script as Lua in the World Editor.

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
| `npm run build` | Evaluate Pkl, transpile Lua, inject object data, and package `dist/bin/map.w3x` |
| `npm run build -- -minify` | Build with Lua minification |
| `npm test` | Build and launch the staged map in Warcraft III |
| `npm run test:unit` | Run regression tests without Pkl or Warcraft III |
| `npm run typecheck` | Check Node build scripts and game code separately |
| `npm run objects:eval` | Evaluate the Pkl manifest into `src/generated/objects.json` |
| `npm run schema:gen` | Regenerate Pkl properties from dependency metadata |
| `npm run bases:gen` | Regenerate base constants and property schemas |
| `npm run build:defs` | Generate TypeScript declarations from the base map's Lua globals |
| `npm run dev` | Watch Pkl definitions and map Lua globals |

`npm test` retains the template's game-launch behavior. Use `npm run test:unit` for automated checks.

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

Node-only build code uses `tsconfig.scripts.json` and stays outside the Lua source tree. Builds evaluate Pkl once and write an ignored `tsconfig.build.<pid>.json`, removed after transpilation. Tracked `tsconfig.json` remains portable. Object injection runs after the transformer so its output is preserved.

Tests cover property normalization, inheritance, invalid manifests, ID collisions, binary round trips for all categories, file persistence, configuration overrides, and compiler configuration isolation. Full build validation additionally requires Pkl; gameplay validation requires Warcraft III.
