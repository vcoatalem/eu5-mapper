export class ArrayHelper {
  public static reduceToRecord<
    TListItem,
    TKey extends string | number | symbol,
    TValue,
  >(
    list: TListItem[],
    keyFn: (item: TListItem) => TKey,
    valueFn: (item: TListItem) => TValue | undefined,
  ): Record<TKey, TValue> {
    return list.reduce(
      (prev, curr) => {
        const key = keyFn(curr);
        const value = valueFn(curr);
        if (value !== undefined) {
          prev[key] = value;
        }
        return prev;
      },
      {} as Record<TKey, TValue>,
    );
  }
}
