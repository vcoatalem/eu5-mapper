

export class ObjectHelper {

  /**
   * Returns typed entries. Only own enumerable keys are returned, so each
   * entry's value is typed as defined (NonNullable). Prefer the single-generic
   * overload when you have a known object type.
   */
  public static getTypedEntries<T extends Record<string, unknown>>(
    obj: T
  ): Array<[keyof T & string, NonNullable<T[keyof T]>]>;
  public static getTypedEntries<TKey extends string, TValue>(
    obj: object
  ): Array<[TKey, TValue]>;
  public static getTypedEntries<T extends Record<string, unknown>>(
    obj: T
  ): Array<[string, unknown]> {
    return Object.entries(obj) as Array<[keyof T & string, NonNullable<T[keyof T]>]>;
  }
}
