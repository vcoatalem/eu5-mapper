export class StringHelper {
  public static isInSearchQuery(str: string, query: string): boolean {
    const normalizeStr = (s: string) =>
      s.toLowerCase().replaceAll("_", " ").trim();
    return normalizeStr(str).includes(normalizeStr(query));
  }

  public static formatLocationName(name: string): string {
    return name
      .replaceAll("_province", "")
      .replaceAll("_area", "")
      .replaceAll("_region", "")
      .replaceAll("_", " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}
