export class NumbersHelper {
  public static addDecimalThousandSeparators(num: number | string): string {
    const numStr = typeof num === "number" ? num.toString() : num;
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
}
