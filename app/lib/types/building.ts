
/**
 * export interface IBuildingTemplate {
   name: string;
   levels: number;
   type: BuildingType;
   harborCapacity: number[]; // harbor capacity increment per level
   proximityCostReductionPercentage: number[]; // percentage reduction per level
   localProximitySource?: number[]; // proximity cost reduction source per level
   placementRestriction?: IPlacementRestrictionConfig;
   locationRestriction?: Array<ILocationIdentifier>;
   countryRestriction?: Array<string>;
 }
 */

import { BuildingType, IPlacementRestrictionConfig } from "./general";


export interface INewBuildingTemplate {
    name: string;
    type: BuildingType;
    upgrade: string | null; // name of potential upgrade path for the building, null if no upgrade available
    downgrade: string | null; // name of potential downgrade path for the building, null if no downgrade available
    cap: number | null; // how many of this building can be built on a single location, null if no cap
    modifiers: {
      localProximitySource?: number | null;
      harborSuitability?: number | null;
      localProximityCostModifier?: number | null;
      globalProximityCostModifier?: number | null;
    };
    placementRestriction?: IPlacementRestrictionConfig;
    buildable: boolean; // whether the building can be built by the player in normal circumstances (false for most "special" buildings)   
}