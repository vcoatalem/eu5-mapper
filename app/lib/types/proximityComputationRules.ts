interface IValueImpact {
  percentageModifier: 10;
  flatModifier: 0;
}

interface IProximityComputationRule {
  baseCost: number;
  baseCostWithMaritimePresence: number;
  baseCostWithoutMaritimePresence: number;
  riverCostReduction: number;
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
}
