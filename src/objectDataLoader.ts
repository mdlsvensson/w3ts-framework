import { ObjectData } from "war3-objectdata-th";

export interface LoadedObjectDef {
  id?: string;
  base: string;
  properNames?: string[];
  unitsSold?: string[];
  itemsSold?: string[];
  unitsTrained?: string[];
  researchesAvailable?: string[];
  structuresBuilt?: string[];
  itemsMade?: string[];
  heroAbilities?: string[];
  abilities?: string[];
  properties?: Record<string, any>;
  [key: string]: any;
}

export interface LoadedObjects {
  heroes?: Record<string, LoadedObjectDef>;
  units?: Record<string, LoadedObjectDef>;
  buildings?: Record<string, LoadedObjectDef>;
  items?: Record<string, LoadedObjectDef>;
  abilities?: Record<string, LoadedObjectDef>;
  buffs?: Record<string, LoadedObjectDef>;
  upgrades?: Record<string, LoadedObjectDef>;
}

/**
 * Validates custom object IDs against collisions and duplicate usage.
 */
function validateCustomIds(data: LoadedObjects): void {
  const seenIds = new Map<string, string>(); // ID -> category:key

  const checkCategory = (category: string, entries?: Record<string, LoadedObjectDef>) => {
    if (!entries) return;
    for (const [key, def] of Object.entries(entries)) {
      const id = def.id || key;
      if (!id || id.length !== 4) {
        throw new Error(
          `[Pkl ObjectData Error] Invalid rawcode '${id}' in ${category}['${key}']. Rawcodes must be exactly 4 characters.`
        );
      }

      // Check duplicate custom IDs across all categories
      if (seenIds.has(id)) {
        throw new Error(
          `[Pkl ObjectData Error] Duplicate ID collision: '${id}' in ${category}['${key}'] was already defined in ${seenIds.get(id)}.`
        );
      }
      seenIds.set(id, `${category}['${key}']`);
    }
  };

  checkCategory("heroes", data.heroes);
  checkCategory("units", data.units);
  checkCategory("buildings", data.buildings);
  checkCategory("items", data.items);
  checkCategory("abilities", data.abilities);
  checkCategory("buffs", data.buffs);
  checkCategory("upgrades", data.upgrades);
}

/**
 * Normalizes friendly property names from Pkl into the property names expected
 * by war3-objectdata-th containers.
 */
function normalizeProps(props: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = { ...props };

  // Handle properties that have the 'undefined' suffix in war3-objectdata-th
  if (result.goldCost !== undefined) result.goldCostundefined = result.goldCost;
  if (result.lumberCost !== undefined) result.lumberCostundefined = result.lumberCost;
  if (result.scalingValue !== undefined) result.scalingValueundefined = result.scalingValue;
  if (result.level !== undefined) result.levelundefined = result.level;
  if (result.priority !== undefined) result.priorityundefined = result.priority;
  if (result.armorType !== undefined) result.armorTypeundefined = result.armorType;
  if (result.tintingColorRed !== undefined) result.tintingColor1Redundefined = result.tintingColorRed;
  if (result.tintingColorGreen !== undefined) result.tintingColor2Greenundefined = result.tintingColorGreen;
  if (result.tintingColorBlue !== undefined) result.tintingColor3Blueundefined = result.tintingColorBlue;
  if (result.stockMaximum !== undefined) result.stockMaximumundefined = result.stockMaximum;
  if (result.stockReplenishInterval !== undefined) result.stockReplenishIntervalundefined = result.stockReplenishInterval;
  if (result.stockStartDelay !== undefined) result.stockStartDelayundefined = result.stockStartDelay;
  if (result.stockInitialAfterStartDelay !== undefined) result.stockInitialAfterStartDelayundefined = result.stockInitialAfterStartDelay;

  // Handle keyword renames
  if (result.movementType !== undefined) result.type = result.movementType;
  if (result.upgradeClass !== undefined) result.class = result.upgradeClass;

  // Join any array properties into comma-separated strings
  for (const [k, v] of Object.entries(result)) {
    if (Array.isArray(v)) {
      result[k] = v.join(",");
    }
  }

  return result;
}

/**
 * Applies a list of unit/hero/building definitions to objectData.units container.
 */
function applyUnitDefs(
  objectData: ObjectData,
  entries: Record<string, LoadedObjectDef> | undefined,
  categoryName: string
): void {
  if (!entries) return;

  for (const [key, def] of Object.entries(entries)) {
    const {
      id,
      base,
      properties,
      ...rawProps
    } = def;

    const unitId = id || key;
    const unit = objectData.units.copy(base, unitId);
    if (!unit) {
      throw new Error(
        `[Pkl ObjectData Error] Failed to copy base unit '${base}' for ${categoryName}['${key}'] with ID '${unitId}'.`
      );
    }

    const normalized = normalizeProps(rawProps);
    Object.assign(unit, normalized);

    if (properties) {
      const normalizedProperties = normalizeProps(properties);
      Object.assign(unit, normalizedProperties);
    }
  }
}

/**
 * Maps declarative object definitions (evaluated from Pkl) to Warcraft III object data
 * using war3-objectdata-th containers.
 */
export function applyObjectData(objectData: ObjectData, data: LoadedObjects): void {
  // 1. Validate custom IDs against duplication and formatting
  validateCustomIds(data);

  // 2. Apply Heroes, Units, and Buildings (all stored in WC3 unit object data)
  applyUnitDefs(objectData, data.heroes, "heroes");
  applyUnitDefs(objectData, data.units, "units");
  applyUnitDefs(objectData, data.buildings, "buildings");

  // 3. Apply Items
  if (data.items) {
    for (const [key, def] of Object.entries(data.items)) {
      const { id, base, properties, ...rawProps } = def;
      const itemId = id || key;
      const item = objectData.items.copy(base, itemId);
      if (!item) {
        throw new Error(`[Pkl ObjectData Error] Failed to copy base item '${base}' for items['${key}'].`);
      }

      const normalized = normalizeProps(rawProps);
      Object.assign(item, normalized);

      if (properties) {
        const normalizedProperties = normalizeProps(properties);
        Object.assign(item, normalizedProperties);
      }
    }
  }

  // 4. Apply Abilities
  if (data.abilities) {
    for (const [key, def] of Object.entries(data.abilities)) {
      const { id, base, properties, ...rawProps } = def;
      const abilityId = id || key;
      const ability = objectData.abilities.copy(base, abilityId);
      if (!ability) {
        throw new Error(`[Pkl ObjectData Error] Failed to copy base ability '${base}' for abilities['${key}'].`);
      }

      const normalized = normalizeProps(rawProps);
      Object.assign(ability, normalized);

      if (properties) {
        const normalizedProperties = normalizeProps(properties);
        Object.assign(ability, normalizedProperties);
      }
    }
  }
}
