import { file, z } from "zod";
import { Jomini } from "jomini";
import {
  GameDataVersion,
  ZodGameDataVersion,
} from "@/app/config/gameData.config";

const ZodSavegameFlagString = z
  .string()
  .regex(/^[A-Z]+=[\s\S]+$/)
  .transform((str) => {
    const [countryCode] = str.split("=");
    return countryCode;
  });

const ZodSavegameCountryTagRecord = z
  .record(z.number(), z.string())
  .transform((record) => {
    return Object.entries(record).map(([index, countryCode]) => {
      return { index: parseInt(index), countryCode };
    });
  });

const ZodLocationIndexList = z.array(z.number());

const ZodLocationIdentifierList = z.array(z.string());

const _jominiParsing = async (fileContent: string) => {
  try {
    const jomini = await Jomini.initialize();
    const parsed = jomini.parseText(fileContent, {}, (q) => {
      const version = q.at("/metadata/version");
      const flag = q.at("/metadata/flag");

      const locationsIndexList = q.at("/metadata/compatibility/locations");
      const countryTagsList = q.at("/countries/tags");

      return { version, flag, locationsIndexList, countryTagsList };
    });

    console.log("[SaveGameImport] parsed save game file:", parsed);
    return parsed;
  } catch (error) {
    console.error("Error while parsing with Jomini:", error);
    throw error;
  }
};

const _jominiParseCountryData = async (
  fileContent: string,
  countryIndex: number,
) => {
  try {
    const jomini = await Jomini.initialize();
    const parsed = jomini.parseText(fileContent, {}, (q) => {
      const countryOwnedLocations = q.at(
        `/countries/database/${countryIndex}/owned_locations`,
      );
      return { countryOwnedLocations };
    });

    return parsed;
  } catch (error) {
    console.error(
      "[SaveGameImport] Error while parsing country data with Jomini:",
      error,
    );
    return null;
  }
};

interface ParsedSaveGameData {
  version: GameDataVersion | null;
  countryCode: string | null;
  locations: string[] | null;
}

export const parsePlainTextSaveGameFile = async (
  fileContent: string,
): Promise<ParsedSaveGameData> => {
  console.log("will parse file data: ", fileContent.slice(0, 100));

  const parsed = await _jominiParsing(fileContent);

  const allLocations = ZodLocationIdentifierList.safeParse(
    parsed.locationsIndexList,
  );
  const locationRecord: Record<number, string> = allLocations.success
    ? allLocations.data.reduce(
        (acc, location, index) => {
          acc[index] = location;
          return acc;
        },
        {} as Record<number, string>,
      )
    : {};

  const parseVersion = ZodGameDataVersion.safeParse(parsed.version);
  const version = parseVersion.success ? parseVersion.data : null;

  const parseCountryCode = ZodSavegameFlagString.safeParse(parsed.flag);
  if (parseCountryCode.error) {
    console.warn(
      "[SaveGameImport] Could not parse country code from flag string:",
      {
        flagString: parsed.flag,
        error: parseCountryCode.error,
      },
    );
  }
  const countryCode = parseCountryCode.success ? parseCountryCode.data : null;

  const countryCodeRecord = ZodSavegameCountryTagRecord.safeParse(
    parsed.countryTagsList,
  );
  if (countryCodeRecord.error) {
    console.warn(
      "[SaveGameImport] Could not parse country code list from save game:",
      {
        countryTagsList: parsed.countryTagsList,
        error: countryCodeRecord.error,
      },
    );
  }

  const countryCodeIndex = countryCodeRecord.success
    ? countryCodeRecord.data.find((entry) => entry.countryCode === countryCode)
        ?.index
    : null;

  const countryData = countryCodeIndex
    ? await _jominiParseCountryData(fileContent, countryCodeIndex)
    : null;
  if (countryCode && !countryData) {
    console.warn(
      "[SaveGameImport] Could not parse country data for country code:",
      countryCode,
    );
  }

  const owned_locations = ZodLocationIndexList.safeParse(
    countryData?.countryOwnedLocations,
  );

  const locations = owned_locations.success
    ? owned_locations.data.map((index) => locationRecord[index])
    : null;

  console.log("[SaveGameImport] parsed informations:", {
    version: parsed.version,
    countryCode,
    countryCodeIndex,
    locations,
  });

  return {
    version,
    countryCode,
    locations,
  };
};
