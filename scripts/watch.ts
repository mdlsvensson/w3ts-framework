import { loadProjectConfig } from "./config.ts";

// Serialize runs so edits made during generation are processed after it finishes.
export async function watchProject(): Promise<void> {
  const mapDir = `maps/${loadProjectConfig().mapFolder}`;
  const pending = new Set<string>();
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function drain(): Promise<void> {
    if (running) return;
    running = true;
    try {
      while (pending.size) {
        const task = pending.values().next().value!;
        pending.delete(task);
        const status = await new Deno.Command(Deno.execPath(), {
          args: ["task", task], stdout: "inherit", stderr: "inherit",
        }).spawn().status;
        if (!status.success) console.error(`${task} failed; waiting for another edit.`);
      }
    } finally {
      running = false;
    }
  }
  console.log(`Watching objects/**/*.pkl and ${mapDir}/**/*.lua`);
  const watcher = Deno.watchFs(["objects", mapDir]);
  try {
    for await (const event of watcher) {
      if (!["create", "modify", "remove", "rename"].includes(event.kind)) continue;
      for (const path of event.paths) {
        if (path.endsWith(".pkl")) pending.add("objects:eval");
        if (path.endsWith(".lua")) pending.add("build:defs");
      }
      if (pending.size) {
        clearTimeout(timer);
        timer = setTimeout(() => { void drain(); }, 150);
      }
    }
  } finally {
    clearTimeout(timer);
    watcher.close();
  }
}

if (import.meta.main) await watchProject();
