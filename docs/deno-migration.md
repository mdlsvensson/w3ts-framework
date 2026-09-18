# Deno 2 migration

The project now runs its build scripts, tests, generators, watcher, and compiler subprocess under Deno. The Warcraft runtime still receives Lua. The npm libraries inherited from `wc3-ts-template` are retained and run using Deno's Node compatibility layer.

## Start here

Use Deno 2.9.6 or newer within the Deno 2 series, the version baseline verified during migration. From the project root:

```powershell
deno install --frozen
deno task typecheck
deno task test:unit
deno task build
```

For gameplay testing, run `deno task test`. It compiles and launches Warcraft III using `config.json` and your local overrides. The regression suite is `deno task test:unit`.

If Pkl is installed but not visible to this terminal, provide its path:

```powershell
$env:PKL_EXECUTABLE = 'C:\path\to\pkl.exe'
deno task objects:eval
```

`PKL_EXECUTABLE` is used by both standalone evaluation and compilation. It is a process environment setting and does not change tracked configuration.

## What changed

| Before | Now |
| --- | --- |
| npm installation and `package-lock.json` | `deno install --frozen` and `deno.lock` |
| `npm run build` as the primary command | `deno task build` |
| `ts-node` executes build TypeScript | Deno executes TypeScript directly |
| `tsconfig.scripts.json` checks build scripts | `deno check` with `deno.json` |
| Node starts the TSTL compiler subprocess | `Deno.execPath()` starts `deno run` with the same compiler |
| Node test runner | `Deno.test` and `deno test` |
| `npm-watch` | `Deno.watchFs` in `scripts/watch.ts` |
| Implicit CommonJS module interop | Explicit default imports and a small constructor adapter |
| Pkl resolved only through PATH | PATH plus optional `PKL_EXECUTABLE` |

Existing npm scripts remain as forwarding aliases to Deno tasks for familiarity with the upstream template. They require Deno and are not a second Node implementation. `npm ci` is no longer the installation path because `package-lock.json` was replaced.

## Why package.json and node_modules remain

The template's libraries come from npm, and the compiler and transformer expect Node-style package resolution. `package.json` therefore remains the dependency manifest. `deno.json` sets `nodeModulesDir` to `auto` so Deno installs these packages locally, including CommonJS dependencies and metadata files read at build time.

Direct dependency versions were pinned to the versions installed before migration. `deno.lock` records Deno's resolved dependency graph, including transitive dependencies. Regenerating that lock intentionally is part of a dependency update; use `deno install --frozen` for reproducible installs.

The Lua language-extension package is now a direct dependency. A clean installation showed that the old configuration depended on npm hoisting it into a location referenced by `tsconfig.json`.

Deno's own TypeScript version checks the build scripts. Game compilation and game type checking deliberately use npm `typescript@5.8.2`, matching `typescript-to-lua@1.31.0`. Changing the build runtime must not silently change the Lua compiler's TypeScript API.

These choices follow Deno's documented [Node/npm compatibility](https://docs.deno.com/runtime/fundamentals/node/) and [Node migration](https://docs.deno.com/runtime/migrate/) support.

## Where compatibility is handled

- Build-script imports use explicit `.ts` extensions and `node:` prefixes for Node built-ins. The game source keeps its TSTL-compatible imports.
- `import.meta.main` replaces CommonJS entry-point checks so importing a build module in tests does not run its CLI.
- `createRequire(import.meta.url)` is used where legacy libraries or compiler paths need CommonJS resolution. It resolves through Deno's compatibility layer.
- `scripts/warcraft-library.ts` unwraps the map library's `exports.default` constructors. Deno's ESM import exposes the CommonJS exports object; it does not apply the same automatic unwrapping previously provided by TypeScript's CommonJS output.
- `fs-extra` uses a default import because its dynamically assembled exports are not all available through an ESM namespace import.
- `scripts/compile.ts` starts the pinned compiler using the current Deno executable. No Node executable is required for that child process.
- `scripts/test.ts` explicitly sets `windowsHide: false` when launching Warcraft III. Deno's child-process compatibility layer otherwise hides Windows subprocess windows, which can leave the game audible but invisible. A follow-up launch with this setting was confirmed visible by the user.

Build tasks use `-A` to retain the template's filesystem, subprocess, environment, and compile-time execution capabilities. This is compatibility with the trusted local build workflow; the migration does not introduce a restricted execution boundary for compile-time callbacks.

The upstream libraries still contain CommonJS and Node APIs. Replacing those libraries or rewriting the binary formats was outside this migration. Continue to verify dependency upgrades against the build and binary regression tests.

## Watch mode

`deno task dev` watches Pkl definitions and the configured base map's Lua files. Pkl edits run `objects:eval`; Lua edits run `build:defs`. Events are debounced and generation jobs run sequentially. Generated JSON and TypeScript declarations are outside the watched paths, avoiding a generation loop.

Watch mode does not automatically build an archive or launch the game. If you change `mapFolder`, restart the watcher to watch the new directory.

## Verification performed

The migration was verified with Deno 2.9.6 and Pkl 0.32.1:

- Eight regression tests passed under `Deno.test`.
- Deno script checking and pinned game TypeScript checking passed.
- The full map build produced a `.w3x` archive.
- A minified build and both type checks passed with the Node executable removed from the process PATH.
- Base constants, property schemas, and Lua global declarations regenerated successfully.
- A temporary project copy with no pre-existing `node_modules` passed frozen dependency installation, both type checks, regression tests, and a full build.
- In that temporary copy, editing a Pkl file and a map Lua file caused watch mode to regenerate both expected outputs.

Warcraft III itself was not launched during migration verification. The project currently has empty object-definition registries; populated categories are covered by the binary regression tests rather than by the default map build.

## Editing and future changes

Add or change commands in `deno.json`. Keep `package.json` forwarding aliases only where useful to users of the original template. Add dependencies to `package.json`, run `deno install` to refresh resolution, and commit `deno.lock` with the manifest change.

Keep build code under `scripts/` and game code under `src/`. If your editor uses the Deno language server, scope it to `scripts/`; game source still belongs to the Warcraft/TSTL TypeScript configuration.

After toolchain changes, run the tests, type checks, and full build. A clean install is especially valuable for changes involving package resolution, because existing npm installations can conceal undeclared dependencies.
