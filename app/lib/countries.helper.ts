import { IGameData, ILocationIdentifier } from "@/app/lib/types/general";

export class CountriesHelper {
  public static getCountryBaseCapitalLocation(
    countryCode: string,
    countriesDataMap: IGameData["countriesData"],
  ): ILocationIdentifier {
    const country = countriesDataMap[countryCode];
    if (!country) {
      throw new Error(`Country not found: ${countryCode}`);
    }
    if (country.capital) {
      return country.capital;
    }
    if (country.locations.length === 0) {
      throw new Error(`Country ${countryCode} has no locations`);
    }
    return country.locations[0];
  }
}
