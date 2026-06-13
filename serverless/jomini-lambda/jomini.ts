import { Jomini } from "./types/jomini";

export class JominiParser {
  private static _instance: JominiParser | null = null;
  private _jomini: Jomini | null = null;

  private constructor() {}

  static getInstance(): JominiParser {
    if (!JominiParser._instance) {
      JominiParser._instance = new JominiParser();
    }
    return JominiParser._instance;
  }

  private async init(): Promise<Jomini> {
    if (!this._jomini) {
      const { Jomini } = await import("jomini");
      this._jomini = await Jomini.initialize();
    }
    return this._jomini;
  }

  // Single pass: resolves country index inline so owned_locations can be fetched
  // in the same parse, avoiding a second full scan of the 350MB+ file.
  async parseRoot(fileContent: Uint8Array) {
    const jomini = await this.init();
    return jomini.parseText(fileContent, {}, (q) => {
      const flag = q.at("/metadata/flag");
      const countryTagsList = q.at("/countries/tags");

      // Derive country index inline (same logic as ZodSavegameFlagString +
      // countryCodeIndex task, but on raw pre-validation data)
      const flagKey = flag?.split("=")?.[0];
      const countryIndex: number | null =
        flagKey && countryTagsList
          ? (() => {
              const entry = Object.entries(countryTagsList).find(
                ([, v]) => v === flagKey,
              );
              return entry ? parseInt(entry[0], 10) : null;
            })()
          : null;

      return {
        version: q.at("/metadata/version"),
        flag,
        locationsIndexList: q.at("/metadata/compatibility/locations"),
        countryTagsList,
        buildings: q.at("/building_manager/database"),
        countryOwnedLocations:
          countryIndex !== null
            ? q.at(`/countries/database/${countryIndex}/owned_locations`)
            : [],
      };
    });
  }
}

export type ParsedRoot = Awaited<ReturnType<JominiParser["parseRoot"]>>;
