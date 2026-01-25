import { ILocationDataMap, ILocationGameData } from "./types";

export class GameDataParser {
  public static parseLocationNameAndColorHex(data: string): {
    nameToColor: Record<string, string>;
    colorToName: Record<string, string>;
  } {
    const lines = data.split("\n");
    const nameToColor: Record<string, string> = {};
    const colorToName: Record<string, string> = {};

    for (const line of lines) {
      if (line.trim().startsWith("#") || line.trim() === "") {
        continue;
      }

      const [locationName, rest] = line.split("=");
      if (!locationName || !rest) continue;

      const hexCode = rest.split("#")[0].trim();
      if (!hexCode) continue;

      colorToName[hexCode] = locationName.trim();
      nameToColor[locationName.trim()] = hexCode;
    }

    return { nameToColor, colorToName };
  }

  public static parseLocationData(data: string): Record<
    string,
    {
      topography: ILocationGameData["topography"];
      vegetation: ILocationGameData["vegetation"];
    }
  > {
    const lines = data.split("\n");
    const res: Record<
      string,
      {
        topography: ILocationGameData["topography"];
        vegetation: ILocationGameData["vegetation"];
      }
    > = {};

    for (const line of lines) {
      if (line.trim().startsWith("#") || line.trim() === "") {
        continue;
      }

      const firstEqualIndex = line.indexOf("=");
      if (firstEqualIndex === -1) continue;

      const locationName = line.substring(0, firstEqualIndex);
      const rest = line.substring(firstEqualIndex + 1);
      if (!locationName || !rest) continue;

      const name = locationName.trim();
      const content = rest.trim();

      // Extract topography
      const topographyMatch = content.match(/topography\s*=\s*(\w+)/);
      const topography = topographyMatch ? topographyMatch[1] : undefined;

      // Extract vegetation
      const vegetationMatch = content.match(/vegetation\s*=\s*(\w+)/);
      const vegetation = vegetationMatch ? vegetationMatch[1] : undefined;

      res[name] = {
        topography:
          (topography as ILocationGameData["topography"]) ?? "unknown",
        vegetation: (vegetation as ILocationGameData["vegetation"]) ?? null,
      };
    }

    return res;
  }
}
