import {
  GAME_DATA_CDN_URL,
  GAME_DATA_PACKAGE_SHA,
} from "@/app/config/gameData.config";
import { ArrayHelper } from "@/app/lib/array.helper";
import { ParserHelper } from "@/app/lib/parser.helper";
import { RoadsHelper } from "@/app/lib/roads.helper";
import {
  BuildingTemplate,
  ZodBuildingTemplateArray,
} from "@/app/lib/types/buildingTemplate";
import { ColorToLocIdentifierMap } from "@/app/lib/types/color";
import { CountryData, ZodCountryData } from "@/app/lib/types/country";
import {
  CountryModifierTemplate,
  ZodCountryModifiersTemplate,
} from "@/app/lib/types/countryModifiers";
import {} from "@/app/lib/types/general";
import {
  LocationGameDataMap,
  ZodLocationGameData,
} from "@/app/lib/types/location";
import {
  ProximityComputationRule,
  ZodProximityComputationRule,
} from "@/app/lib/types/proximityComputationRules";
import { BaseRoadRecord } from "@/app/lib/types/roads";
import {
  FILE_TYPE_TO_MANIFEST_KEY,
  GameDataFileType,
  VersionManifest,
  ZodVersionManifest,
} from "@/app/lib/types/versionsManifest";
import { ZodError } from "zod";

export interface IGameDataParsedFiles {
  locationData: {
    map: LocationGameDataMap;
    colorToNameMap: ColorToLocIdentifierMap;
  };
  buildingsTemplate: Record<string, BuildingTemplate>;
  adjacencyCsv: string;
  proximityComputationRule: ProximityComputationRule;
  countriesData: Record<string, CountryData>;
  roads: BaseRoadRecord;
  countryModifiersTemplate: Record<string, CountryModifierTemplate>;
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

  private static async fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`could not fetch file at ${url}: ${res.status}`);
    }
    return res.arrayBuffer();
  }

  private static async gunzip(
    compressedBuffer: ArrayBuffer,
  ): Promise<Uint8Array> {
    const isNodeEnv = typeof window === "undefined";

    if (isNodeEnv) {
      const { gunzipSync } = await import("zlib");
      return gunzipSync(Buffer.from(compressedBuffer));
    }

    if (typeof DecompressionStream === "undefined") {
      throw new Error("Gzip decompression is not available in this browser");
    }

    const decompressionStream = new DecompressionStream("gzip");
    const decompressedStream = new Response(compressedBuffer).body?.pipeThrough(
      decompressionStream,
    );

    if (!decompressedStream) {
      throw new Error("Unable to decompress gzip response");
    }

    const decompressedBuffer = await new Response(
      decompressedStream,
    ).arrayBuffer();
    return new Uint8Array(decompressedBuffer);
  }

  private static async loadTextFileFromManifest(
    fileUrl: string,
    compressed: boolean,
  ): Promise<ResponseLike> {
    const arrayBuffer = await this.fetchArrayBuffer(fileUrl);
    const decodedBytes = compressed
      ? await this.gunzip(arrayBuffer)
      : new Uint8Array(arrayBuffer);
    const content = new TextDecoder().decode(decodedBytes);
    return this.createResponseLike(content);
  }

  private static getManifestEntry(
    manifest: VersionManifest,
    fileType: GameDataFileType,
  ) {
    const manifestKey = FILE_TYPE_TO_MANIFEST_KEY[fileType];
    return manifest[manifestKey];
  }

  private static readonly fileTypeHandlers: FileTypeHandlers = {
    locationData: async (res) => {
      const parsingErrors: Array<ZodError> = [];
      const locationMap: LocationGameDataMap = {};
      const colorToNameMap: ColorToLocIdentifierMap = {};

      const json = await res.json();
      if (!Array.isArray(json)) {
        throw new Error(
          `Expected location data to be an array, got ${typeof json}`,
        );
      }
      for (const item of json) {
        const zodLocation = ZodLocationGameData.safeParse(item);
        if (!zodLocation.success) {
          parsingErrors.push(zodLocation.error);
          continue;
        }

        locationMap[zodLocation.data.name] = zodLocation.data;
        colorToNameMap[zodLocation.data.hexColor] = zodLocation.data.name;
      }

      if (parsingErrors.length > 0) {
        parsingErrors.forEach((error, index) => {
          console.error(`Error parsing location entry #${index}:`, error);
        });
        throw new Error(
          "Failed to parse some location data entries. See console for details.",
        );
      }

      return { map: locationMap, colorToNameMap };
    },
    buildingsTemplate: async (res) => {
      const array = ZodBuildingTemplateArray.safeParse(await res.json());

      if (array.success === false) {
        console.error("Failed to parse buildings template JSON:", array.error);
        throw new Error(
          "Invalid buildings template format. check console for details",
        );
      }

      return ArrayHelper.reduceToRecord(
        array.data,
        (entry) => entry.name,
        (entry) => entry,
      );
    },
    adjacencyCsv: async (res) => {
      const text = await res.text();
      ParserHelper.parseAdjacencyCSV(text); // not needed, but validates the format early
      return text;
    },
    proximityComputationRule: async (res) => {
      const json = await res.json();
      const parsed = ZodProximityComputationRule.safeParse(json);
      if (!parsed.success) {
        throw new Error(`${parsed.error}`);
      }
      return parsed.data;
    },
    countriesData: async (res) => {
      const json = await res.json();
      if (!Array.isArray(json)) {
        throw new Error(
          `Expected countries data to be an array, got ${typeof json}`,
        );
      }
      const countryData: Record<string, CountryData> = {};
      const parsingErrors: Array<ZodError> = [];

      for (const country of json) {
        const parsedCountry = ZodCountryData.safeParse(country);
        if (!parsedCountry.success) {
          parsingErrors.push(parsedCountry.error);
          continue;
        }
        countryData[parsedCountry.data.code] = parsedCountry.data;
      }

      if (parsingErrors.length > 0) {
        parsingErrors.forEach((error, index) => {
          console.error(`Error parsing country data entry #${index}:`, error);
        });
        throw new Error(
          "Failed to parse some country data entries. See console for details.",
        );
      }

      return countryData;
    },
    countryModifiersTemplate: async (res) => {
      const json = await res.json();
      if (!Array.isArray(json)) {
        throw new Error(
          `Expected country modifiers template to be an array, got ${typeof json}`,
        );
      }
      const modifiers: Array<CountryModifierTemplate> = [];
      const parsingErrors: Array<ZodError> = [];

      for (const item of json) {
        const parsed = ZodCountryModifiersTemplate.safeParse(item);
        if (!parsed.success) {
          parsingErrors.push(parsed.error);
          continue;
        }
        modifiers.push(parsed.data);
      }

      if (parsingErrors.length > 0) {
        parsingErrors.forEach((error, index) => {
          console.error(
            `Error parsing country modifier template entry #${index}:`,
            error,
          );
        });
        throw new Error(
          "Failed to parse some country modifier template entries. See console for details.",
        );
      }
      return ArrayHelper.reduceToRecord(
        modifiers,
        (entry) => entry.name,
        (entry) => entry,
      );
    },
    roads: async (res) => {
      const roadsContent = await res.text();
      const roads: Array<[string, string]> = roadsContent
        .split("\n")
        .splice(1) // remove header
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          const [from, to] = line.split(",").map((part) => part.trim());
          return [from, to] as [string, string];
        });
      return RoadsHelper.roadRecordFromCsv(roads);
    },
  };

  public static readonly defaultGameDataFileTypes: Array<
    keyof IGameDataParsedFiles
  > = [
    "locationData",
    "buildingsTemplate",
    "adjacencyCsv",
    "proximityComputationRule",
    "countriesData",
    "roads",
  ];

  public static async loadGameDataFilesForVersion(
    version: string,
    manifest: VersionManifest,
    gameDataFileTypes: Array<
      keyof IGameDataParsedFiles
    > = GameDataLoaderHelper.defaultGameDataFileTypes,
  ): Promise<IGameDataParsedFiles> {
    const entries = await Promise.all(
      gameDataFileTypes.map(async (fileType) => {
        try {
          const manifestEntry = this.getManifestEntry(manifest, fileType);
          const fileUrl = this.getGameDataFileUrl(version, manifestEntry.name);

          console.log(
            `will load file ${manifestEntry.name} from url:`,
            fileUrl,
          );
          const res = await this.loadTextFileFromManifest(
            fileUrl,
            manifestEntry.compressed,
          );

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
      locationData: {
        map: LocationGameDataMap;
        colorToNameMap: ColorToLocIdentifierMap;
      };
      buildingsTemplate: Record<string, BuildingTemplate>;
      adjacencyCsv: string;
      proximityComputationRule: ProximityComputationRule;
      countriesData: Record<string, CountryData>;
      roads: BaseRoadRecord;
      countryModifiersTemplate: Record<string, CountryModifierTemplate>;
    };
  }

  public static getGameDataFileUrl(version: string, fileName: string): string {
    return `${GAME_DATA_CDN_URL}/${GAME_DATA_PACKAGE_SHA}/${version}/${fileName}`;
  }

  public static getFileUrlForVersion(
    version: string,
    fileType: GameDataFileType,
    manifest: VersionManifest,
  ): string {
    const manifestEntry = this.getManifestEntry(manifest, fileType);
    return this.getGameDataFileUrl(version, manifestEntry.name);
  }

  public static async loadGameDataFileForVersion<
    TFileType extends keyof IGameDataParsedFiles,
  >(
    version: string,
    fileType: TFileType,
    manifest: VersionManifest,
  ): Promise<IGameDataParsedFiles[TFileType]> {
    const manifestEntry = this.getManifestEntry(manifest, fileType);
    const fileUrl = this.getGameDataFileUrl(version, manifestEntry.name);
    const responseLike = await this.loadTextFileFromManifest(
      fileUrl,
      manifestEntry.compressed,
    );
    return this.fileTypeHandlers[fileType](responseLike);
  }

  public static async loadManifestForVersion(
    version: string,
  ): Promise<VersionManifest> {
    const manifestUrl = this.getGameDataFileUrl(version, "manifest.json");
    const res = await fetch(manifestUrl);
    if (!res.ok) {
      throw new Error(
        `Could not fetch manifest for version ${version}: ${res.status}`,
      );
    }
    const rawManifest = await res.json();
    const parsedManifest = ZodVersionManifest.safeParse(rawManifest);
    if (!parsedManifest.success) {
      throw new Error(
        `[GameDataLoaderHelper] Invalid manifest for version ${version}: ${parsedManifest.error.message}`,
      );
    }
    return parsedManifest.data;
  }
}
