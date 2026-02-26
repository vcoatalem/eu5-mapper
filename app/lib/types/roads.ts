import { ILocationIdentifier } from "@/app/lib/types/general";

export type RoadKey = `${ILocationIdentifier}-${ILocationIdentifier}` & { readonly __brand: unique symbol };

export function asRoadKey(s: string): RoadKey {
  if (!/^.+-.+$/.test(s)) throw new Error(`Invalid RoadKey format: ${s}`);
  return s as RoadKey;
}
export type RoadType =
  | "gravel_road"
  | "paved_road"
  | "modern_road"
  | "rail_road";
export const allRoadTypes: readonly RoadType[] = ["gravel_road", "paved_road", "modern_road", "rail_road"];
