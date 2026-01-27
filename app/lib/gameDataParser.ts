import { ILocationGameData } from "./types";

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

  public static parseMapConfig(data: string): {
    nonOwnable: Set<string>;
    impassableMountains: Set<string>;
  } {
    const nonOwnable = new Set<string>();
    const impassableMountains = new Set<string>();

    let currentSection: "none" | "non_ownable" | "impassable_mountains" =
      "none";

    const lines = data.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();

      // Check for section headers
      if (trimmedLine.startsWith("non_ownable")) {
        currentSection = "non_ownable";
        continue;
      }
      if (trimmedLine.startsWith("impassable_mountains")) {
        currentSection = "impassable_mountains";
        continue;
      }

      // Check if we're leaving a section
      if (trimmedLine === "}") {
        currentSection = "none";
        continue;
      }

      // Skip comments and empty lines
      if (trimmedLine.startsWith("#") || trimmedLine === "") {
        continue;
      }

      // If we're in a section, extract location names
      if (currentSection !== "none") {
        // Split by whitespace and filter out comments
        const locationNames = trimmedLine
          .split(/\s+/)
          .filter((name) => name && !name.startsWith("#"));

        for (const locationName of locationNames) {
          if (currentSection === "non_ownable") {
            nonOwnable.add(locationName);
          } else if (currentSection === "impassable_mountains") {
            impassableMountains.add(locationName);
          }
        }
      }
    }

    return { nonOwnable, impassableMountains };
  }

  public static parseLocationHierarchy(data: string): Record<
    string,
    {
      continent: string;
      subcontinent: string;
      region: string;
      area: string;
      province: string;
    }
  > {
    const locationHierarchy: Record<
      string,
      {
        continent: string;
        subcontinent: string;
        region: string;
        area: string;
        province: string;
      }
    > = {};
    const lines = data.split("\n");

    const hierarchyStack: string[] = [];
    let insideProvince = false;
    let currentProvinceLocations: string[] = [];

    for (const line of lines) {
      // Skip comments and empty lines
      if (line.trim().startsWith("#") || line.trim() === "") {
        continue;
      }

      // Count leading tabs to determine depth
      const leadingTabs = line.match(/^\t*/)?.[0].length ?? 0;

      // Handle closing braces
      if (line.trim() === "}") {
        // If we were inside a province, process collected locations
        if (insideProvince && currentProvinceLocations.length > 0) {
          const hierarchyValue = {
            continent: hierarchyStack[0] ?? "",
            subcontinent: hierarchyStack[1] ?? "",
            region: hierarchyStack[2] ?? "",
            area: hierarchyStack[3] ?? "",
            province: hierarchyStack[4] ?? "",
          };

          for (const locationName of currentProvinceLocations) {
            locationHierarchy[locationName] = hierarchyValue;
          }

          currentProvinceLocations = [];
          insideProvince = false;
        }
        
        hierarchyStack.pop();
        continue;
      }

      // Check for single-line province definition: province = { loc1 loc2 ... }
      const singleLineMatch = line.match(
        /^\t*(\w+_province)\s*=\s*\{\s*(.+?)\s*\}/
      );
      if (singleLineMatch) {
        const provinceName = singleLineMatch[1];
        const locationsLine = singleLineMatch[2];

        // Update the province in hierarchy stack
        hierarchyStack[leadingTabs] = provinceName;
        hierarchyStack.length = leadingTabs + 1;

        // Extract individual location names
        const locationNames = locationsLine
          .split(/\s+/)
          .filter(
            (name) =>
              name && !name.startsWith("#") && name !== "{" && name !== "}"
          );

        // Build hierarchy object
        const hierarchyValue = {
          continent: hierarchyStack[0] ?? "",
          subcontinent: hierarchyStack[1] ?? "",
          region: hierarchyStack[2] ?? "",
          area: hierarchyStack[3] ?? "",
          province: hierarchyStack[4] ?? "",
        };

        // Assign this hierarchy to all locations in this province
        for (const locationName of locationNames) {
          locationHierarchy[locationName] = hierarchyValue;
        }
        continue;
      }

      // Check for multi-line province definition start: province = {
      const multiLineProvinceMatch = line.match(/^\t*(\w+_province)\s*=\s*\{$/);
      if (multiLineProvinceMatch) {
        const provinceName = multiLineProvinceMatch[1];
        hierarchyStack[leadingTabs] = provinceName;
        hierarchyStack.length = leadingTabs + 1;
        insideProvince = true;
        currentProvinceLocations = [];
        continue;
      }

      // Check if this line contains an opening brace (non-province)
      const openBraceMatch = line.match(/^\t*(\w+)\s*=\s*\{/);
      if (openBraceMatch && !openBraceMatch[1].endsWith("_province")) {
        const name = openBraceMatch[1];
        hierarchyStack[leadingTabs] = name;
        hierarchyStack.length = leadingTabs + 1;
        continue;
      }

      // If we're inside a province definition, collect location names
      if (insideProvince) {
        const locationNames = line
          .trim()
          .split(/\s+/)
          .filter(
            (name) =>
              name && !name.startsWith("#") && name !== "{" && name !== "}"
          );
        currentProvinceLocations.push(...locationNames);
      }
    }

    return locationHierarchy;
  }
}
