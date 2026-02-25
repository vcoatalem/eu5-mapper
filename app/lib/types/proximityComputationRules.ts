import { RoadType, Topography, Vegetation } from "./general";

export interface ICountryProximityBuffs {
  genericModifier?: number;
  landModifier?: number;
  seaWithMaritimeFlatCostReduction?: number
  seaWithoutMaritimeFlatCostReduction?: number;
  portFlatCostReduction?: number;
  mountainsMultiplier?: number;
  plateauMultiplier?: number;
  hillsMultiplier?: number;
}

export interface ICountryProximityBuffsMetadata {
  label: string;
  valueDefinition: IBuffValueDescriptor;
}

type IBuffValueDescriptor = { type: "flat" | "percentage"; description: string };
type IBuffPercentageValue = { type: "percentage"; value: number };
type IBuffFlatValue = { type: "flat"; value: number };

export type IBuffValue =
  | IBuffPercentageValue
  | IBuffFlatValue;

export interface IProximityComputationRule {
  proximityPercentageModifierType: "proximityCostReduction" | "proximitySpeedIncrease"; 
  // this is the value that additive percentage modifiers are summing up to.
  // proximityCostReduction is the additive modifier that was used in 1.0.11
  // proximitySpeedIncrease is the multiplicative modifier that is used since 1.1.0
  throughSeaEdgeCountedAsLandProximity: boolean;
  baseCost: number;
  baseRiverCost: number;
  baseCostWithMaritimePresence: number;
  baseCostWithoutMaritimePresence: number;
  topography: Record<Topography, IBuffValue>;
  vegetation: Record<Exclude<Vegetation, null>, IBuffValue>;
  developmentImpact: IBuffValue;
  harborSuitabilityImpact: IBuffPercentageValue;
  harborSuitabilityIsMultiplicative: boolean;
  valuesImpact: {
    landVsNaval: [ICountryProximityBuffs, ICountryProximityBuffs];
    centralizationVsDecentralization: [ICountryProximityBuffs, ICountryProximityBuffs];
  };
  rulerAdministrativeAbilityImpact: IBuffValue;
  roadProximityCostReduction: Record<RoadType, IBuffValue>;
}
