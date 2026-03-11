import { ZodBuildingTemplateRecord } from "@/app/lib/types/buildingTemplate";
import { ZodColorToLocIdentifierMap } from "@/app/lib/types/color";
import { ZodCountryDataRecord } from "@/app/lib/types/country";
import { ZodLocationGameDataRecord } from "@/app/lib/types/location";
import { ZodBaseRoadRecord } from "@/app/lib/types/roads";
import { ZodProximityComputationRule } from "./proximityComputationRules";

import { z } from "zod";

export type ILocationIdentifier = string; // location name

export const ZodGameData = z.object({
  locationDataMap: ZodLocationGameDataRecord,
  colorToNameMap: ZodColorToLocIdentifierMap,
  buildingsTemplate: ZodBuildingTemplateRecord,
  proximityComputationRule: ZodProximityComputationRule,
  countriesData: ZodCountryDataRecord,
  roads: ZodBaseRoadRecord,
});

export type GameData = z.infer<typeof ZodGameData>;
