import { Timer, Unit } from "w3ts";
import { Players } from "w3ts/globals";
import { W3TS_HOOK, addScriptHook } from "w3ts/hooks";
import { Units } from "@objectdata/units";
import { applyObjectData } from "./objectDataLoader";

const BUILD_DATE = compiletime(() => new Date().toUTCString());
const TS_VERSION = compiletime(() => require("typescript").version);
const TSTL_VERSION = compiletime(() => require("typescript-to-lua").version);

compiletime(({ objectData }) => {
  const path = require("path");
  const data = require(path.resolve("src/generated/objects.json"));
  const { applyObjectData } = require(path.resolve("src/objectDataLoader"));

  applyObjectData(objectData, data);
  objectData.save();
});

function tsMain() {
  try {
    print(`Build: ${BUILD_DATE}`);
    print(`Typescript: v${TS_VERSION}`);
    print(`Transpiler: v${TSTL_VERSION}`);
    print(" ");
    print("Welcome to Warcraft III TypeScript Framework with Pkl!");

    const unit = Unit.create(Players[0], FourCC(Units.Footman), 0, 0, 270)!;

    Timer.create().start(1.0, true, () => {
      unit.color = Players[math.random(0, bj_MAX_PLAYERS)].color;
    });
  } catch (e) {
    print(e);
  }
}

addScriptHook(W3TS_HOOK.MAIN_AFTER, tsMain);
