import { AppContext } from "@/app/appContextProvider";
import { FormatedProximity } from "@/app/components/formatedProximity.component";
import { PopulationIcon } from "@/app/components/indicatorsIcons/populationIcon.component";
import { ProximityIcon } from "@/app/components/indicatorsIcons/proximityIcon.component";
import { Loader } from "@/app/components/loader.component";
import { debouncedProximityComputationController } from "@/app/lib/proximityComputation.controller";
import { ProximityComputationHelper } from "@/app/lib/proximityComputation.helper";
import {
  IGameState,
  IGameStateOwnedLocationRecord,
} from "@/app/lib/types/gameState";
import { ILocationIdentifier } from "@/app/lib/types/general";
import { NumbersHelper } from "@/app/lib/utils/numbers.helper";
import { useContext, useMemo, useRef, useSyncExternalStore } from "react";

interface ICountryStatsProps {
  ownedLocations: IGameStateOwnedLocationRecord;
  className?: string;
}
export function CountryStats(props: ICountryStatsProps) {
  const avgProxDivRef = useRef<HTMLDivElement>(null);
  const totalPopDivRef = useRef<HTMLDivElement>(null);
  const popProxDivRef = useRef<HTMLDivElement>(null);
  const { ownedLocations } = props;
  const proximityComputation = useSyncExternalStore(
    debouncedProximityComputationController.subscribe.bind(
      debouncedProximityComputationController,
    ),
    () => debouncedProximityComputationController.getSnapshot(),
  );
  const gameData = useContext(AppContext).gameData;

  const { meanProximity, totalPopulation, totalPopulationScaledByProximity } =
    useMemo(() => {
      const populationByLocation: Record<ILocationIdentifier, number> = {};
      const proximityByLocations: Record<ILocationIdentifier, number> = {};
      const populationScaledByProximityPerLocation: Record<
        ILocationIdentifier,
        number
      > = {};

      if (!gameData || proximityComputation.status !== "completed") {
        return {
          meanProximity: 0,
          totalPopulation: 0,
          totalPopulationScaledByProximity: 0,
        };
      }

      for (const loc of Object.keys(ownedLocations)) {
        const population = gameData?.locationDataMap[loc]?.population ?? 0;
        const proximity = ProximityComputationHelper.evaluationToProximity(
          proximityComputation.result[loc]?.cost ?? 100,
        );
        populationByLocation[loc] = population;
        proximityByLocations[loc] = proximity;
        populationScaledByProximityPerLocation[loc] =
          (proximity * population) / 100;
      }

      const proximityValues = Object.values(proximityByLocations);
      const populationValues = Object.values(populationByLocation);
      const scaledValues = Object.values(
        populationScaledByProximityPerLocation,
      );

      const meanProximity =
        proximityValues.length > 0
          ? Math.max(
              0,
              proximityValues.reduce((a, b) => a + b, 0) /
                proximityValues.length,
            )
          : 0;
      const totalPopulation = populationValues.reduce((a, b) => a + b, 0);
      const totalPopulationScaledByProximity = Math.round(
        Math.max(
          0,
          scaledValues.reduce((a, b) => a + b, 0),
        ),
      );

      return {
        meanProximity,
        totalPopulation,
        totalPopulationScaledByProximity,
      };
    }, [gameData, proximityComputation, ownedLocations]);

  if (!ownedLocations || Object.keys(ownedLocations).length === 0) {
    return null;
  }

  return (
    <div className={"flex flex-wrap gap-2 " + (props.className ?? "")}>
      <div className="flex justify-center items-center gap-1 pr-1 border-stone-400 border rounded-md p-1">
        <div className={""} ref={avgProxDivRef}>
          <div className="flex flex-row items-center gap-1 ">
            <ProximityIcon
              size={24}
              tooltip="Average Proximity of owned locations"
            />
            <span className="text-stone-400 text-xs">(avg) </span>
          </div>
        </div>
        {proximityComputation.status === "completed" ? (
          <FormatedProximity
            className=""
            proximity={meanProximity}
          ></FormatedProximity>
        ) : (
          <Loader></Loader>
        )}
      </div>

      <div
        className="flex justify-center items-center gap-1 pr-1 border-stone-400 border rounded-md p-1"
        ref={totalPopDivRef}
      >
        <div className="">
          <PopulationIcon
            size={24}
            tooltip="Total population of owned locations"
          />
        </div>
        <span className="">
          {NumbersHelper.addDecimalThousandSeparators(totalPopulation)}
        </span>
      </div>

      <div className="flex justify-center items-center gap-1 pr-1 border-stone-400 border rounded-md p-1">
        <div ref={popProxDivRef} className="">
          <div className="flex flex-row items-center gap-1">
            <PopulationIcon
              size={24}
              tooltip="Total population scaled by proximity of owned locations"
            />
            <span className="text-stone-400">X</span>
            <ProximityIcon
              size={24}
              tooltip="Total population scaled by proximity of owned locations"
            />
          </div>
        </div>
        {proximityComputation.status === "completed" ? (
          <span className="">
            {NumbersHelper.addDecimalThousandSeparators(
              totalPopulationScaledByProximity,
            )}
            (
            <FormatedProximity
              proximity={
                (totalPopulationScaledByProximity * 100) / totalPopulation
              }
            ></FormatedProximity>
            %)
          </span>
        ) : (
          <Loader></Loader>
        )}
      </div>
    </div>
  );
}
