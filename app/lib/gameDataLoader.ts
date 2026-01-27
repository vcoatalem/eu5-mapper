import fs from "fs";
import { version } from "os";
import { join } from "path";

type GameVersion = "0.0.11"; // || future game versions

type GameDataFiles = {
  locationClassificationFilePath: string;
  locationDataFilePath: string;
  provincesDataFilePath: string;
  locationsColorMappingFilePath: string;
  locationsCityCoordinatesMapFilePath: string;
  buildingsDataFilePath: string;
};

const baseFolderNames: GameDataFiles = {
  locationClassificationFilePath: "locations_classification",
  locationDataFilePath: "locations_data",
  provincesDataFilePath: "provinces_data",
  locationsColorMappingFilePath: "locations_color_mapping",
  locationsCityCoordinatesMapFilePath: "locations_city_coordinates",
  buildingsDataFilePath: "buildings_data",
};

export class GameDataLoader {
  private static folderPath = join(process.cwd(), "game_data");
  /**
   * @param availableVersions list of available semver versions (ex: 0.0.11, 0.1.0, 0.1.1, 1.0.0)
   * @returns the targetVersion if found, the closest previous version otherwise
   */
  private static getClosestVersion = (
    availableVersions: string[],
    targetVersion: GameVersion,
  ): string => {
    if (availableVersions.includes(targetVersion)) {
      return targetVersion;
    }

    let closestMatch: string | null = null;

    for (const version of availableVersions) {
      if (/[0-9]+\.[0-9]+\.[0-9]+/.test(version)) {
        continue;
      }
      // we count on semver versions being alphabetically ordered
      if (version < targetVersion) {
        if (!closestMatch || version > closestMatch) {
          closestMatch = version;
        }
      }
    }
    if (!closestMatch) {
      throw new Error(
        `Could not find any suitable version for target version ${targetVersion}`,
      );
    }

    return closestMatch;
  };

  public static async getGameFilesForVersion(
    version: GameVersion,
  ): Promise<GameDataFiles> {
    const gameFiles: Partial<GameDataFiles> = {};

    for (const [key, baseFolderName] of Object.entries(baseFolderNames) as [
      keyof GameDataFiles,
      string,
    ][]) {
      const versionsAvailable = await fs.promises.readdir(
        join(this.folderPath, baseFolderName),
      );

      console.log("versions available for " + key + ": " + versionsAvailable);

      const foundVersion = this.getClosestVersion(versionsAvailable, version);

      const versionFiles = await fs.promises.readdir(
        join(this.folderPath, baseFolderName, foundVersion),
      );

      gameFiles[key] = join(
        this.folderPath,
        baseFolderName,
        foundVersion,
        versionFiles[0],
      ); // assuming only one file per version
    }
    console.log("game files resolved:", gameFiles);
    return gameFiles as GameDataFiles; //TODO: ses if there is a clean way to avoid casting here
  }
}
