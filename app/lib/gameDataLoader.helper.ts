import { ParserHelper } from "@/app/lib/parser.helper";
import { INewBuildingTemplate } from "@/app/lib/types/building";
import {
  BaseRoadRecord,
  ICountryData,
  ICountryModifierTemplate,
  ILocationDataMap,
  ILocationIdentifierMap,
} from "@/app/lib/types/general";
import { IProximityComputationRule } from "@/app/lib/types/proximityComputationRules";
import { GameDataFileType } from "@/app/lib/types/versionsManifest";
import { VersionResolver } from "@/app/lib/versionResolver";

export interface IGameDataParsedFiles {
  locationDataMap: ILocationDataMap;
  colorToNameMap: ILocationIdentifierMap;
  buildingsTemplate: Record<string, INewBuildingTemplate>;
  adjacencyCsv: string;
  proximityComputationRule: IProximityComputationRule;
  countriesDataMap: Record<string, ICountryData>;
  roads: BaseRoadRecord;
  countryModifiersTemplate: Record<string, ICountryModifierTemplate>;
}

// Node.js environment stub of fetch Response object
type ResponseLike = {
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

type FileTypeHandlers = {
  [K in keyof IGameDataParsedFiles]: (
    response: Response | ResponseLike,
  ) => Promise<IGameDataParsedFiles[K]>;
};

export class GameDataLoaderHelper {
  /**
   * Creates a Response-like object from filesystem content for Node.js environment
   */
  private static createResponseLike(content: string): ResponseLike {
    return {
      json: async (): Promise<unknown> => {
        try {
          return JSON.parse(content);
        } catch (error) {
          throw new Error(
            `Failed to parse JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      },
      text: async () => content,
    };
  }

  /**
   * Loads a file in either browser or Node.js environment
   */
  private static async loadFile(
    filePath: string,
  ): Promise<Response | ResponseLike> {
    const isNodeEnv = typeof window === "undefined";

    if (isNodeEnv) {
      // Node.js environment: read from filesystem
      const fs = await import("fs/promises");
      const path = await import("path");

      // Convert web path to filesystem path
      const filesystemPath = path.join(process.cwd(), "public", filePath);
      const content = await fs.readFile(filesystemPath, "utf-8");

      return this.createResponseLike(content);
    } else {
      // Browser environment: use fetch
      const res = await fetch(filePath);
      if (!res.ok) {
        throw new Error(`could not fetch file: ${res.status}`);
      }
      return res;
    }
  }
  private static readonly fileTypeHandlers: FileTypeHandlers = {
    locationDataMap: async (res) => {
      return (await res.json()) as ILocationDataMap;
    },
    colorToNameMap: async (res) => {
      return (await res.json()) as ILocationIdentifierMap;
    },
    buildingsTemplate: async (res) => {
      return (await res.json()) as Record<string, INewBuildingTemplate>;
    },
    adjacencyCsv: async (res) => {
      return (await res.text()) as string;
    },
    proximityComputationRule: async (res) => {
      return (await res.json()) as IProximityComputationRule;
    },
    countriesDataMap: async (res) => {
      return (await res.json()) as Record<string, ICountryData>;
    },
    countryModifiersTemplate: async (res) => {
      const arr = (await res.json()) as ICountryModifierTemplate[];
      if (!Array.isArray(arr)) {
        throw new Error(
          `Expected country modifiers template to be an array, got ${typeof arr}`,
        );
      }
      return arr.reduce(
        (acc, entry) => {
          acc[entry.name] = entry;
          return acc;
        },
        {} as Record<string, ICountryModifierTemplate>,
      );
    },
    roads: async (res) => {
      const roadsJson = await res.json();
      // Ensure roadsJson is an array (handle both browser Response and Node.js ResponseLike)
      if (!Array.isArray(roadsJson)) {
        throw new Error(
          `Expected roads data to be an array, got ${typeof roadsJson}. ` +
            `Value: ${JSON.stringify(roadsJson).substring(0, 100)}`,
        );
      }
      return ParserHelper.parseRoadFile(roadsJson);
    },
  };

  public static readonly defaultGameDataFileTypes: GameDataFileType[] = [
    "locationDataMap",
    "colorToNameMap",
    "buildingsTemplate",
    "adjacencyCsv",
    "proximityComputationRule",
    "countriesDataMap",
    "roads",
  ];

  public static async loadGameDataFilesForVersion(
    version: string,
    resolver: VersionResolver,
    gameDataFileTypes: GameDataFileType[] = GameDataLoaderHelper.defaultGameDataFileTypes,
  ): Promise<IGameDataParsedFiles> {

    const entries = await Promise.all(
      gameDataFileTypes.map(async (fileType) => {
        try {
          const resolvedVersion = await resolver.resolveFileVersion(
            fileType,
            version,
          );
          const filePath = resolver.getFilePath(fileType, resolvedVersion);

          // Load the file (works in both browser and Node.js)
          const res = await this.loadFile(filePath);

          const handler =
            this.fileTypeHandlers[fileType as keyof IGameDataParsedFiles];
          const data = await handler(res);
          return [fileType, data] as const;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          throw new Error(
            `Failed to preload game data file ${fileType}: ${errorMsg}`,
          );
        }
      }),
    );

    return Object.fromEntries(entries) as {
      locationDataMap: ILocationDataMap;
      colorToNameMap: ILocationIdentifierMap;
      buildingsTemplate: Record<string, INewBuildingTemplate>;
      adjacencyCsv: string;
      proximityComputationRule: IProximityComputationRule;
      countriesDataMap: Record<string, ICountryData>;
      roads: BaseRoadRecord;
      countryModifiersTemplate: Record<string, ICountryModifierTemplate>;
    };
  }
}
