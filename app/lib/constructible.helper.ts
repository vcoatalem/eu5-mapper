import { IBuildingTemplate, IConstructibleLocation, ILocationIdentifier } from "./types/general";


type ConstructibleState = {
  buildings: Array<{
    key: number;
    name: IBuildingTemplate["name"]
    built: boolean
    canBuild: boolean;
  }>
}

export class ConstructibleHelper {


  public getConstructibleState(location: ILocationIdentifier, constructible: IConstructibleLocation): ConstructibleState {
    
  }
}