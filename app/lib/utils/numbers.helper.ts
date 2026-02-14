export class NumbersHelper {
  public static addDecimalThousandSeparators(num: number | string): string {
    const numStr = typeof num === "number" ? num.toString() : num;
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  public static formatWithSymbol(value: number): string {
    if (value > 1e6) {
      const [formatted, decimal] = (value / 1e6).toFixed(2).split(".");
      return `${this.addDecimalThousandSeparators(formatted)}M`;
    } else if (value > 1e3) {
      const [formatted, decimal] = (value / 1e3).toFixed(2).split(".");
      return `${this.addDecimalThousandSeparators(formatted)}K`;
    } else {
      return value.toString();
    }
  }
}
