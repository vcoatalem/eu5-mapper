import { AppContext } from "@/app/appContextProvider";
import { ObjectHelper } from "@/app/lib/object.helper";
import { IBuildingInstance } from "@/app/lib/types/building";
import { useContext } from "react";

interface BuildingDescriptionProps {
  buildingTemplateName: string;
  instance?: IBuildingInstance;
}

export function BuildingDescription(props: BuildingDescriptionProps) {
  const { buildingTemplateName, instance } = props;
  const gameData = useContext(AppContext)?.gameData;

  const buildingTemplate = gameData?.buildingsTemplate[buildingTemplateName];
  if (!buildingTemplate) {
    console.error(`[BuildingDescription] building template ${buildingTemplateName} not found`);
    return null;
  }
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-lg font-bold">{buildingTemplate.name}</h1>
      <hr></hr>
      <p>This building yields the following modifiers to this location:</p>
      <ul>
        {ObjectHelper.getTypedEntries(buildingTemplate.modifiers).map(([modKey, modValue]) => {
          return (
            <li key={modKey}>
              <span className="font-bold">{modKey}:</span>
              <span>{modValue}</span>
            </li>
          )
        })}
      </ul>
      {instance && (
        <>
          <hr></hr>
          <div>
            <span className="font-bold">{instance.level} instance{instance.level > 1 ? "s" : ""} of this building in this location</span>
          </div>
        </>

      )}
    </div>
  );
}