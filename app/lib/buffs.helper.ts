import { IBuffValue } from "@/app/lib/types/proximityComputationRules";

export class BuffsHelper {
  public static sumBuffs(buffs: IBuffValue[]): number {
    if (buffs.length === 0) {
      return 0;
    }
    return buffs.reduce((acc, buff) => {
      const newValue = acc.value + buff.value
      if (buff.type !== acc.type) {
        throw new Error("Cannot sum buffs with different types");
      }
      return { value: newValue, type: buff.type };
    }, { value: 0, type: buffs[0].type }).value;
  }
}