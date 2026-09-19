# Deno Modernization & Tooling Architecture

This document records the architectural changes, refactors, and conventions established in this session. It serves as high-density context for future AI models (including GPT-6) and human contributors working on `w3ts-framework`.

---

## 1. Runtime Topology & System Boundaries

`w3ts-framework` operates across two strictly separated execution environments:

```
+-----------------------------------------------------------------------+
|                              REPOSITORY                               |
+-----------------------------------+-----------------------------------+
|  1. Build & Automation Layer      |  2. Game Runtime Layer            |
|     (scripts/, objects/)          |     (src/)                        |
+-----------------------------------+-----------------------------------+
| Runtime: Deno 2.9+ (native V8)    | Target: Warcraft III (Lua 5.3)    |
| Package Mgr: Deno + npm compat    | Transpiler: TypeScript-to-Lua     |
| Libraries: @std/fs, @std/path     | Framework: w3ts 3.0.2             |
| Definitions: Apple Pkl CLI        | Types: lua-types, war3-types      |
+-----------------------------------+-----------------------------------+
```

* **No Node.js runtime is installed or required.** Deno executes all build scripts, tests, watchers, and child processes directly.
* **TSTL and Warcraft npm dependencies remain in `node_modules`.** TSTL 1.31 (`typescript-to-lua`) and its compiler plugins (`war3-transformer`) require Node-style module resolution to locate plugins and `.d.ts` declaration trees at build time.

---

## 2. Key Changes Made This Session

### A. Custom Warcraft Deno Lint Plugin (`scripts/lint/wcraft-rules.ts`)
* **Problem:** General-purpose linters do not understand Warcraft III / TSTL constraints. Developers frequently make rawcode typos (e.g. `FourCC("hfo")` or `FourCC("hfoo1")`) which compile cleanly in TypeScript but crash or drop entities in-game.
* **Solution:** Created an in-tree Deno 2 lint plugin (`wcraft-rules`) implementing `valid-fourcc`:
  * Validates string literal arguments passed to `FourCC(...)`.
  * Enforces `length === 4`.
  * Enforces printable ASCII characters (`/^[\x20-\x7E]{4}$/`).
* **Gotcha Discovered:** Deno strictly requires plugin names to match `/^[a-z-]+$/` (lowercase letters and hyphens only; no numbers like `w3ts-rules`).

### B. JSON Syntax & Configuration Validation (`scripts/validate-json.ts`)
* Implemented standalone validator checking syntax for `config.json`, `config.local.json`, `deno.json`, `package.json`, and `tsconfig.json`.
* Calls `loadProjectConfig()` to ensure the merged configuration adheres to all schema rules (`mapFolder` matches `*.w3x`, `gameExecutable` is non-empty, `launchArgs` is string array, etc.).
* Registered as `deno task lint:json` and integrated into `deno task lint`.

### C. Baseline `deno lint` Configuration (`deno.json`)
* Added `"lint"` section to `deno.json`:
  * Registers custom plugin `"./scripts/lint/wcraft-rules.ts"`.
  * Excludes generated code: `src/war3map.d.ts` (World Editor global trigger declarations that use `declare var`), `src/generated`, `dist`, `node_modules`.
  * Enables strict rules: `no-eval`, `no-throw-literal`, `no-sparse-arrays`, `no-sync-fn-in-async-fn`.
* Resolved legacy lint errors:
  * Replaced `any` in `loadJsonFile` with generic `T`.
  * Replaced `catch (err: any)` with `catch (err: unknown)` in `scripts/dev.ts`.

### D. Enforced Frozen Lockfile (`deno.json`)
* Added `"lock": { "frozen": true }` to `deno.json`.
* **Behavior:** Prevents accidental modification or drift of `deno.lock` when running tasks or builds.
* **Workflow Rule:** Deliberate dependency additions or version bumps require `deno install --frozen=false`.

### E. Extracted Filesystem Utility (`scripts/files.ts`)
* Decoupled generic file I/O out of `scripts/config.ts`:
  * `loadJsonFile<T = Record<string, unknown>>(filename: string): T`
  * `writeJsonFile(filename: string, value: unknown, options?: { spaces?: number }): void`
  * `removeIfExists(filename: string): void`
* `scripts/config.ts` now strictly owns configuration interfaces and validation (`IProjectConfig`, `readConfig`, `loadProjectConfig`).

### F. Purged `node:path` in Favor of `@std/path`
* Replaced all occurrences of `import * as path from "node:path"` across the repository with `import * as path from "@std/path"`.
* Added `"@std/path": "jsr:@std/path@^1.1.5"` to `deno.json` import map.
* **API Difference:** In `node:path`, the path separator is `path.sep`. In `@std/path`, it is `path.SEPARATOR`.

### G. Purged `node:module` and `createRequire`
* Completely eliminated `createRequire(import.meta.url)`:
  * Legacy CommonJS packages (`war3tstlhelper`, `luamin`, `war3-objectdata-th`) now use direct ESM imports (`import War3TSTLHelper from "war3tstlhelper"`, `import luamin from "luamin"`, etc.).
  * Path resolution previously using `require.resolve("typescript-to-lua/dist/tstl.js")` now uses web-standard `fromFileUrl(import.meta.resolve("typescript-to-lua/dist/tstl.js"))`.

### H. Platform Abstraction & Wine Support
* Clarified role of `winePath` and `winePrefix` in `IProjectConfig`:
  * Optional settings populated only via `config.local.json` on Linux/macOS.
  * When present, `scripts/test.ts` translates map paths to Wine virtual drive paths (`Z:\...`) and sets the `WINEPREFIX` environment variable.

---

## 3. Directory & File Manifest

| File | Responsibility |
| :--- | :--- |
| [`deno.json`](file:///c:/Users/mdlsvensson/Repo/w3ts-framework/deno.json) | Task orchestration, compiler options, Deno lint rules, plugin registration, import map, frozen lockfile setting. |
| [`scripts/lint/wcraft-rules.ts`](file:///c:/Users/mdlsvensson/Repo/w3ts-framework/scripts/lint/wcraft-rules.ts) | Custom Deno lint plugin enforcing Warcraft III rawcode rules (`FourCC`). |
| [`scripts/files.ts`](file:///c:/Users/mdlsvensson/Repo/w3ts-framework/scripts/files.ts) | Generic Deno file helpers (`loadJsonFile`, `writeJsonFile`, `removeIfExists`). |
| [`scripts/config.ts`](file:///c:/Users/mdlsvensson/Repo/w3ts-framework/scripts/config.ts) | Project configuration loading, validation, and schema definitions. |
| [`scripts/compile.ts`](file:///c:/Users/mdlsvensson/Repo/w3ts-framework/scripts/compile.ts) | Pkl evaluation, dynamic `tsconfig.build.<pid>.json` generation, TSTL invocation, and object data injection. |
| [`scripts/validate-json.ts`](file:///c:/Users/mdlsvensson/Repo/w3ts-framework/scripts/validate-json.ts) | JSON syntax and project configuration schema validation runner. |
| [`scripts/dev.ts`](file:///c:/Users/mdlsvensson/Repo/w3ts-framework/scripts/dev.ts) | Generates TypeScript definitions (`src/war3map.d.ts`) from base map globals using `War3TSTLHelper`. |
| [`scripts/tests/run.ts`](file:///c:/Users/mdlsvensson/Repo/w3ts-framework/scripts/tests/run.ts) | Regression test suite (13 unit tests covering binary I/O, config, lint rules, JSON validation, and CLI logging). |

---

## 4. Operational Invariants & AI Guidelines

When making further changes to this repository, AI models must preserve the following rules:

1. **Do not introduce `node:*` imports if `@std/*` or `Deno.*` equivalents exist:**
   * Use `@std/fs` and `Deno.*` instead of `node:fs` or `fs-extra`.
   * Use `@std/path` instead of `node:path`. Note the uppercase `path.SEPARATOR`.
   * Use `fromFileUrl(import.meta.resolve(...))` instead of `node:module` / `require.resolve`.
2. **Never commit without running the verification trifecta:**
   * `deno task lint` (runs Deno lint + JSON syntax/schema checks).
   * `deno task test:unit` (runs regression test suite).
   * `deno task typecheck` (type-checks both `scripts/` with Deno and `src/` with pinned `typescript@5.8.2`).
3. **Lockfile updates must be explicit:**
   * Because `"lock": { "frozen": true }` is enabled in `deno.json`, any change to dependencies or import maps requires running `deno install --frozen=false`.
4. **Child process execution in tests:**
   * When spawning subprocesses with `Deno.Command` in tests located outside the repository root (e.g. in temp folders), pass `--config <path-to-deno.json>` if the executed script imports bare `@std/*` specifiers.
5. **Preserve game source isolation (`src/`):**
   * Code in `src/` compiles to Lua 5.3. Never use Node, Deno, or browser globals in `src/` unless explicitly wrapped in a compile-time macro (`compiletime(() => ...)`).
