import { useEffect, useSyncExternalStore } from "react";
import {
  debouncedShortestPathController,
  IShortestPathResult,
  shortestPathController,
} from "@/app/lib/shortestPath.controller";
import { ILocationIdentifier } from "@/app/lib/types/general";
import { Loader } from "./loader.component";
import { DrawingHelper } from "../lib/drawing/drawing.helper";
import { ColorHelper } from "../lib/drawing/color.helper";
import { FormatedProximityCost } from "./formatedProximityCost.component";

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
        Closest proximity source: {proximityResult.sourceLocation} (
        <span>{proximityResult.proximity}</span>){" "}
        {/*TODO: helper to put proximity cost in a span with proper color applied (use in neighbors panel too)*/}
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

  useEffect(() => {
    if (!locationResult || locationResult.status === "needs_update") {
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
    </div>
  );
}
