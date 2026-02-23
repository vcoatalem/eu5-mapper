import { RoadType } from "./general";

export interface IProximityBuffs {
  genericModifier?: number;
  landModifier?: number;
  seaWithMaritimeFlatCostReduction?: number
  seaWithoutMaritimeFlatCostReduction?: number;
  portFlatCostReduction?: number;
  mountainsHillsPlateauxMultiplier?: number;
}

export interface IProximityBuffDisplayableData {
  label: string;
  description: string;
}

export interface IProximityComputationRule {
  proximityModifiersStackingMode: "additive" | "multiplicative";
  baseCost: number;
  baseRiverCost: number;
  baseCostWithMaritimePresence: number;
  baseCostWithoutMaritimePresence: number;
  proximityCostIncreasePercentage: {
    topography: {
      flatland: number;
      hills: number;
      wetlands: number;
      mountains: number;
      plateau: number;
    };
    vegetation: {
      forest: number;
      woods: number;
      jungle: number;
      desert: number;
      farmland: number;
      sparse: number;
      grasslands: number;
    };
  };
  developmentImpact: number;
  harborCapacityImpact: number;
  valuesImpact: {
    landVsNaval: [IProximityBuffs, IProximityBuffs];
    centralizationVsDecentralization: [IProximityBuffs, IProximityBuffs];
  };
  rulerAdministrativeAbilityImpact: number;
  roadProximityCostReduction: Record<RoadType, number>;
  throughSeaEdgeCountedAsLandProximity: boolean;
}
