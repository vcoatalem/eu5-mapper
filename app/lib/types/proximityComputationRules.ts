interface IProximityComputationRule {
  baseCost: number;
  riverCostReduction: number;
  proximityCostIncreasePercentage: {
    topography: {
      flatlands: number;
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
  maritimePresenceImpact: number;
}
