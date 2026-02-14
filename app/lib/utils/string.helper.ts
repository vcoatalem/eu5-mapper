export class StringHelper {
  public static isInSearchQuery(str: string, query: string): boolean {
    const normalizeStr = (s: string) =>
      s.toLowerCase().replaceAll("_", " ").trim();
    return normalizeStr(str).includes(normalizeStr(query));
  }
}
