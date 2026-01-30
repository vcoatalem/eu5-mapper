import {
  IConstructibleLocation,
  IGameData,
  ILocationGameData,
} from "./types/general";

export class ProximityComputationHelper {
  public static getEnvironmentalProximityCostIncreasePercentage = (
    location: ILocationGameData,
    gameData: IGameData,
  ): number => {
    const rule = gameData.proximityComputationRule;

    if (
      !Object.keys(rule.proximityCostIncreasePercentage.topography).includes(
        location.topography,
      )
    ) {
      console.warn(
        "[ProximityComputationController] Missing topography proximity cost increase percentage for ",
        location.topography,
      );
    }
    const topographyCostIncreasePercentage =
      rule.proximityCostIncreasePercentage.topography?.[
        location.topography as keyof IProximityComputationRule["proximityCostIncreasePercentage"]["topography"]
      ] ?? 0;

    if (
      location.vegetation &&
      !Object.keys(rule.proximityCostIncreasePercentage.vegetation).includes(
        location?.vegetation,
      )
    ) {
      console.warn(
        "[ProximityComputationController] Missing vegetation proximity cost increase percentage for ",
        location.vegetation,
      );
    }

    const vegetationCostIncreasePercentage = location.vegetation
      ? (rule.proximityCostIncreasePercentage.vegetation?.[
          location.vegetation as keyof IProximityComputationRule["proximityCostIncreasePercentage"]["vegetation"]
        ] ?? 0)
      : 0;

    const totalEnvironmentalCostIncrease =
      topographyCostIncreasePercentage + vegetationCostIncreasePercentage;

    return totalEnvironmentalCostIncrease;
  };

  public static getLocationProximityLocalCostReductionPercentage = (
    location: ILocationGameData,
    locationConstructibleData: IConstructibleLocation,
    gameData: IGameData,
  ): number => {
    if (location.isSea || location.isLake) {
      return 0;
    }
    const buildings = locationConstructibleData.buildings ?? [];
    const totalBuildingsCostReduction = buildings
      .map(
        (b) => b.template.proximityCostReductionPercentage?.[b.level - 1] ?? 0,
      )
      .reduce((a, b) => a + b, 0);
    const environmentalProximityCostIncreasePercentage =
      ProximityComputationHelper.getEnvironmentalProximityCostIncreasePercentage(
        location,
        gameData,
      );

    const development = location.development; // todo: use temporary value instead, to allow user modifying dev values
    const developmentCostReduction =
      development * gameData.proximityComputationRule.developmentImpact;

    const total =
      // positive proximity (cost reduction)
      totalBuildingsCostReduction +
      developmentCostReduction -
      // negative proximity (cost increase)
      environmentalProximityCostIncreasePercentage;
    return total;
  };

  public static getLocationHarborCapacity = (
    locationData: ILocationGameData,
    locationConstructibleData: IConstructibleLocation,
  ): number => {
    const naturalHarborSuitability = locationData.naturalHarborSuitability ?? 0;

    const buildings = locationConstructibleData.buildings ?? [];
    const totalBuildingsHarborCapacity = buildings
      .map((b) => {
        const capacity = b.template.harborCapacity?.[b.level - 1];
        return capacity || 0;
      })
      .reduce((a, b) => a + b, 0);

    return naturalHarborSuitability + totalBuildingsHarborCapacity;
  };
}
