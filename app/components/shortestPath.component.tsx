import { FormatedProximity } from "@/app/components/formatedProximity.component";
import { useGameEngine, useModel } from "@/app/lib/gameEngineContext";
import { IShortestPathResult } from "@/app/lib/shortestPath.model";
import { LocationIdentifier } from "@/app/lib/types/general";
import { StringHelper } from "@/app/lib/utils/string.helper";
import { useEffect } from "react";
import { FormatedProximityCost } from "./formatedProximityCost.component";
import { Loader } from "./loader.component";

interface IShortestPathComponentProps {
  location: LocationIdentifier;
  className?: string;
}

function ShortestPathDisplay(props: {
  location: LocationIdentifier;
  proximityResult: NonNullable<
    IShortestPathResult["result"][LocationIdentifier]["proximityResult"]
  >;
}) {
  const { proximityResult } = props;
  if (proximityResult.sourceLocation === props.location) {
    return (
      <span>
        {StringHelper.formatLocationName(props.location)} is a proximity source
        (
        <FormatedProximity
          proximity={proximityResult.proximity}
        ></FormatedProximity>
        )
      </span>
    );
  }
  return (
    <div>
      <span className="text-md">
        <b>{StringHelper.formatLocationName(proximityResult.sourceLocation)}</b>{" "}
        is the closest proximity source (
        <FormatedProximity
          proximity={proximityResult.proximity}
        ></FormatedProximity>
        )
      </span>
      <hr className="my-2 border-white border"></hr>
      <div className="flex flex-col gap-2">
        {proximityResult.path.map((step, index) => (
          <span key={index} className="flex flex-row items-center gap-1">
            {StringHelper.formatLocationName(
              index === 0
                ? proximityResult.sourceLocation
                : proximityResult.path[index - 1].throughLocation,
            )}
            {" → "}
            {StringHelper.formatLocationName(step.throughLocation)}(
            <FormatedProximityCost
              proximityCost={step.cost}
            ></FormatedProximityCost>{" "}
            via {step.through})
          </span>
        ))}
      </div>
    </div>
  );
}

export function ShortestPathComponent(props: IShortestPathComponentProps) {
  const { shortestPathController } = useGameEngine();
  const { result } = useModel("debouncedShortestPath");

  const locationResult = result?.[props.location];

  useEffect(() => {
    if (
      props.location &&
      (!locationResult || locationResult.status === "needs_update")
    ) {
      shortestPathController.launchComputeShortestPathFromProximitySourceTask(
        props.location,
      );
    }
  }, [props.location, locationResult, shortestPathController]);

  return (
    <div className={props.className ?? ""}>
      {!locationResult ||
        (["pending", "needs_update"].includes(locationResult.status) && (
          <Loader></Loader>
        ))}
      {locationResult &&
        locationResult.status === "completed" &&
        locationResult.proximityResult && (
          <ShortestPathDisplay
            location={props.location}
            proximityResult={locationResult.proximityResult}
          />
        )}
      {locationResult &&
        locationResult.status === "completed" &&
        !locationResult.proximityResult && (
          <span>No path found to any proximity source</span>
        )}
    </div>
  );
}
