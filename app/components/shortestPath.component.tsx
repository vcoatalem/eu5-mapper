import { useEffect, useSyncExternalStore } from "react";
import {
  debouncedShortestPathController,
  IShortestPathResult,
  shortestPathController,
} from "@/app/lib/shortestPath.controller";
import { ILocationIdentifier } from "@/app/lib/types/general";
import { Loader } from "./loader.component";
import { FormatedProximityCost } from "./formatedProximityCost.component";
import { FormatedProximity } from "@/app/components/formatedProximity.component";

interface IShortestPathComponentProps {
  location: ILocationIdentifier;
  className: string;
}

function ShortestPathDisplay(props: {
  proximityResult: NonNullable<
    IShortestPathResult["result"][ILocationIdentifier]["proximityResult"]
  >;
}) {
  const { proximityResult } = props;
  return (
    <div>
      <span>
        Closest proximity source: {proximityResult.sourceLocation}(
        <FormatedProximity
          proximity={proximityResult.proximity}
        ></FormatedProximity>
        )
      </span>
      <div className="flex flex-col gap-2">
        {proximityResult.path.map((step, index) => (
          <span key={index}>
            {" → "}
            {step.throughLocation} (
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
  const { result } = useSyncExternalStore(
    debouncedShortestPathController.subscribe.bind(
      debouncedShortestPathController,
    ),
    () => debouncedShortestPathController.getSnapshot(),
  );

  const locationResult = result?.[props.location];

  console.log({ locationResult });

  useEffect(() => {
    if (
      props.location &&
      (!locationResult || locationResult.status === "needs_update")
    ) {
      shortestPathController.launchComputeShortestPathFromProximitySourceTask(
        props.location,
      );
    }
  }, [props.location]);

  return (
    <div className={props.className}>
      {!locationResult ||
        (["pending", "needs_update"].includes(locationResult.status) && (
          <Loader></Loader>
        ))}
      {locationResult &&
        locationResult.status === "completed" &&
        locationResult.proximityResult && (
          <ShortestPathDisplay
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
