import { ILocationDetailedViewData } from "@/app/components/detailedList/detailedLocationListModal.component";

export function DisplayHarborSuitability(props: { data: ILocationDetailedViewData }) {
  if (!props.data.baseLocationGameData.isCoastal) {
    return null;
  }
  return <div className="px-2 py-1 group w-full h-full flex flex-row items-center relative">
    <span>{props.data.computedLocationData.harborSuitability}</span>
  </div>
}