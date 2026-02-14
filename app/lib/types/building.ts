export type BuildingType = "rural" | "urban" | "city" | "common";

export type PlacementRestrictions =
  | "is_coastal"
  | "has_river"
  | "is_adjacent_to_lake"
  | "has_road"
  | "is_capital";

export type PlacementRestrictionCondition =
  | PlacementRestrictions
  | IPlacementRestrictionConfig;

export interface IPlacementRestrictionConfig {
  op: "AND" | "OR";
  conditions: PlacementRestrictionCondition[];
}

export interface IBuildingInstance {
  template: INewBuildingTemplate;
  level: number;
}

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
