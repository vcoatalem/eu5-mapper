import { RoadType } from "./general";

interface IValueImpact {
  percentageModifier: 10;
  flatModifier: 0;
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
    landVsNaval: [IValueImpact, IValueImpact];
    centralizationVsDecentralization: [IValueImpact, IValueImpact];
  };
  rulerAdministrativeAbilityImpact: number;
  roadProximityCostReduction: Record<RoadType, number>;
  throughSeaEdgeCountedAsLandProximity: boolean;
}
