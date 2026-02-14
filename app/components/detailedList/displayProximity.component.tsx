import { ILocationDetailedViewData } from "@/app/components/detailedList/detailedLocationListModal.component";
import { FormattedProximityWithPathfindingTooltip } from "@/app/components/formattedProximityWithPathfindingTooltip.component";

export function DisplayProximity(props: { data: ILocationDetailedViewData }) {
  return (
    <FormattedProximityWithPathfindingTooltip
      className=""
      location={props.data.baseLocationGameData.name}
      proximity={props.data.proximity ?? 0}
    ></FormattedProximityWithPathfindingTooltip>
  );
}
