import { ZodType, z } from "zod";

export interface CountryProximityBuffsMetadata {
  label: string;
  valueDefinition: BuffValueDescriptor;
}

type BuffValueDescriptor = {
  type: "flat" | "percentage";
  description: string;
};
type BuffPercentageValue = { type: "percentage"; value: number };
type BuffFlatValue = { type: "flat"; value: number };

export type BuffValue = BuffPercentageValue | BuffFlatValue;

export const ZodBuffValue: ZodType<BuffValue> = z.union([
  z.object({
    type: z.literal("percentage"),
    value: z.number(),
  }),
  z.object({
    type: z.literal("flat"),
    value: z.number(),
  }),
]);
