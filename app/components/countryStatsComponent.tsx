import { AppContext } from "@/app/appContextProvider";
import { FormatedProximity } from "@/app/components/formatedProximity.component";
import { Loader } from "@/app/components/loader.component";
import { debouncedProximityComputationController } from "@/app/lib/proximityComputation.controller";
import { ProximityComputationHelper } from "@/app/lib/proximityComputation.helper";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import { IGameState, ILocationIdentifier } from "@/app/lib/types/general";
import { NumbersHelper } from "@/app/lib/utils/numbers.helper";
import { useContext, useMemo, useRef, useSyncExternalStore } from "react";

interface ICountryStatsProps {
  ownedLocations: IGameState["ownedLocations"];
  className?: string;
  align?: boolean;
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

  return (
    <div
      className={
        "flex flex-wrap gap-2 divide-stone-600 " +
        (!props.align ? " divide-x-2 " : "") +
        (props.className ?? "")
      }
    >
      <div className="flex justify-center items-center gap-1 pr-1">
        <div className={props.align ? "w-24" : ""} ref={avgProxDivRef}>
          <Tooltip>
            <TooltipTrigger>
              <span className="font-bold text-yellow-500 cursor-help">
                Avg Prox
              </span>
            </TooltipTrigger>
            <TooltipContent
              anchor={{
                type: "dom",
                ref: avgProxDivRef as React.RefObject<HTMLElement>,
              }}
            >
              <span>Average Proximity of owned locations</span>
            </TooltipContent>
          </Tooltip>
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
        className="flex justify-center items-center gap-1 pr-1"
        ref={totalPopDivRef}
      >
        <div className={props.align ? "w-24" : ""}>
          <Tooltip>
            <TooltipTrigger>
              <span className="font-bold text-yellow-500 cursor-help">Pop</span>
            </TooltipTrigger>
            <TooltipContent
              anchor={{
                type: "dom",
                ref: totalPopDivRef as React.RefObject<HTMLElement>,
              }}
            >
              <span>Total population of owned locations</span>
            </TooltipContent>
          </Tooltip>
        </div>
        <span className="">
          {NumbersHelper.addDecimalThousandSeparators(totalPopulation)}
        </span>
      </div>

      <div className="flex justify-center items-center gap-1 pr-1">
        <div ref={popProxDivRef} className={props.align ? "w-24" : ""}>
          <Tooltip>
            <TooltipTrigger>
              <span className="font-bold text-yellow-500 cursor-help">
                Pop * Prox
              </span>
            </TooltipTrigger>
            <TooltipContent
              anchor={{
                type: "dom",
                ref: popProxDivRef as React.RefObject<HTMLElement>,
              }}
            >
              <span>
                Total population scaled by proximity of owned locations
              </span>
            </TooltipContent>
          </Tooltip>
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
