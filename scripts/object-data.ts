import { ObjectData } from "war3-objectdata-th";
import type { Container, IDs } from "war3-objectdata-th/dist/cjs/container.js";

export interface LoadedObjectDef {
  id?: string;
  base: string;
  properties?: Record<string, unknown> | null;
  [key: string]: unknown;
}

const categories = {
  heroes: "units", units: "units", buildings: "units", items: "items",
  abilities: "abilities", buffs: "buffs", upgrades: "upgrades",
} as const;

export type LoadedObjects = Partial<Record<keyof typeof categories, Record<string, LoadedObjectDef>>>;

/** Shared by schema generation and the loader so aliases cannot drift. */
export function friendlyPropertyName(name: string): string {
  const colors: Record<string, string> = {
    tintingColor1Redundefined: "tintingColorRed", tintingColor2Greenundefined: "tintingColorGreen",
    tintingColor3Blueundefined: "tintingColorBlue",
  };
  if (colors[name]) return colors[name];
  const clean = name.replace(/undefined$/, "");
  const aliases: Record<string, string> = {
    type: "movementType", class: "upgradeClass",
  };
  return aliases[clean] ?? clean;
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  return value as Record<string, unknown>;
}

/** Null means inherit; explicit false, zero, empty strings and lists are overrides. */
function normalizeProps(props: Record<string, unknown>, base: object, context: string): Record<string, unknown> {
  const names = new Map(Object.keys(base).map(name => [friendlyPropertyName(name), name]));
  for (const [alias, name] of Object.entries({
    abilities: "normal", heroAbilities: "hero", name: "nameEditorOnly",
    tintingColorRed: "tintingColor1Red", tintingColorGreen: "tintingColor2Green", tintingColorBlue: "tintingColor3Blue",
  })) {
    if (Object.prototype.hasOwnProperty.call(base, name)) names.set(alias, name);
  }
  const result: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(props)) {
    if (value == null) continue;
    const engineName = Object.prototype.hasOwnProperty.call(base, name) ? name : names.get(name);
    if (!engineName || engineName === "oldId" || engineName === "newId") {
      throw new Error(`${context}: unknown or reserved property '${name}'.`);
    }
    if (Array.isArray(value)) {
      if (typeof (base as Record<string, unknown>)[engineName] !== "string") {
        throw new Error(`${context}.${name} is a scalar field; per-level arrays are not supported by the object-data library.`);
      }
      if (!value.every(entry => typeof entry === "string" || typeof entry === "number")) {
        throw new Error(`${context}.${name} must contain only strings or numbers.`);
      }
      result[engineName] = value.join(",");
    } else if (["string", "number", "boolean"].includes(typeof value)) {
      result[engineName] = value;
    } else {
      throw new Error(`${context}.${name} must be a scalar or list.`);
    }
  }
  return result;
}

/** Validate the complete manifest before copying any custom objects. */
export function applyObjectData(objectData: ObjectData, input: unknown): void {
  const data = record(input, "Object manifest");
  const seen = new Map<string, string>();
  const pending: Array<() => void> = [];
  for (const [category, entries] of Object.entries(data)) {
    if (!Object.prototype.hasOwnProperty.call(categories, category)) {
      throw new Error(`Unknown object category '${category}'.`);
    }
    const container: Container<IDs> = objectData[categories[category as keyof typeof categories]];
    for (const [key, value] of Object.entries(record(entries, category))) {
      const context = `${category}['${key}']`;
      const { id = key, base, properties, ...props } = record(value, context);
      for (const [label, rawcode] of [["id", id], ["base", base]]) {
        if (typeof rawcode !== "string" || !/^[A-Za-z0-9]{4}$/.test(rawcode)) {
          throw new Error(`${context}: ${label} '${rawcode}' must be a four-character alphanumeric rawcode.`);
        }
      }
      const customId = id as string;
      if (seen.has(customId)) throw new Error(`${context}: duplicate ID '${customId}' already defined in ${seen.get(customId)}.`);
      seen.set(customId, context);
      if (container.get(customId)) throw new Error(`${context}: ID '${customId}' already exists in game or map data.`);
      const source = container.get(base as string);
      if (!source) throw new Error(`${context}: base '${base}' does not exist.`);
      const normalized = {
        ...normalizeProps(props, source, context),
        ...normalizeProps(properties == null ? {} : record(properties, `${context}.properties`), source, context),
      };
      pending.push(() => Object.assign(container.copy(source, customId)!, normalized));
    }
  }
  for (const apply of pending) apply();
}
