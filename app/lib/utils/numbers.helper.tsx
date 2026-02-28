import { ReactNode } from "react";

export class NumbersHelper {
  public static addDecimalThousandSeparators(num: number | string): string {
    const numStr = typeof num === "number" ? num.toString() : num;
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  private static getDecimalPlacesForFloatingPart(num: number): number {
    if (num / 1e2 >= 1) {
      return 0;
    }
    if (num / 1e1 >= 1) {
      return 1;
    }
    return 2;
  }

  public static formatWithSymbol(value: number): ReactNode {
    const millions = Math.floor(value / 1e6);
    const thousands = Math.floor((value % 1e6) / 1e3);
    const hundreds = Math.floor((value % 1e3) / 1e2);
    const remainder = value % 1e3;

    let quotient = "";
    let decimal = "";

    if (millions) {
      quotient = millions + "M";
      const nDecimalPlaces = this.getDecimalPlacesForFloatingPart(millions);
      decimal =
        thousands > 0 ? thousands.toString().slice(0, nDecimalPlaces) : "";
    } else if (thousands) {
      quotient = thousands + "K";
      const nDecimalPlaces = this.getDecimalPlacesForFloatingPart(thousands);
      decimal =
        hundreds > 0 ? hundreds.toString().slice(0, nDecimalPlaces) : "";
    } else {
      quotient = remainder.toString();
    }

    return (
      <span>
        {quotient}
        {decimal ? <span className="text-xs">{decimal}</span> : null}
      </span>
    );
  }
}
