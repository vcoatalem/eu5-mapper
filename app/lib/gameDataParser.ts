import { ILocationDataMap } from "./types";

export class GameDataParser {
  public static parseLocationData(data: string): ILocationDataMap {
    const lines = data.split("\n");
    const res: ILocationDataMap = {};

    for (const line of lines) {
      if (line.trim().startsWith("#") || line.trim() === "") {
        continue;
      }

      const [locationName, rest] = line.split("=");
      if (!locationName || !rest) continue;

      const hexCode = rest.split("#")[0].trim();
      if (!hexCode) continue;

      res[hexCode] = {
        name: locationName.trim(),
      };
    }

    return res;
  }
}
