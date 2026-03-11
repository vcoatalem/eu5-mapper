import z from "zod";

export const ZodRoadKey = z
  .string()
  .regex(/^.+-.+$/, "Invalid RoadKey format")
  .brand<"RoadKey">();

export type RoadKey = z.infer<typeof ZodRoadKey>;

export const ZodRoadType = z.enum([
  "gravel_road",
  "paved_road",
  "modern_road",
  "rail_road",
]);
export type RoadType = z.infer<typeof ZodRoadType>;
export const allRoadTypes: readonly RoadType[] = [
  "gravel_road",
  "paved_road",
  "modern_road",
  "rail_road",
];

export const ZodBaseRoadRecord = z.record(ZodRoadKey, ZodRoadType);
export const ZodRoadRecord = z.record(ZodRoadKey, ZodRoadType.nullable());

export type BaseRoadRecord = z.infer<typeof ZodBaseRoadRecord>;
export type RoadRecord = z.infer<typeof ZodRoadRecord>;
