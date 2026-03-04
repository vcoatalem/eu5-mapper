import { ZodType, z } from "zod";

export interface ICountryProximityBuffsMetadata {
  label: string;
  valueDefinition: IBuffValueDescriptor;
}

type IBuffValueDescriptor = {
  type: "flat" | "percentage";
  description: string;
};
type IBuffPercentageValue = { type: "percentage"; value: number };
type IBuffFlatValue = { type: "flat"; value: number };

export type IBuffValue = IBuffPercentageValue | IBuffFlatValue;

export const ZodBuffValue: ZodType<IBuffValue> = z.union([
  z.object({
    type: z.literal("percentage"),
    value: z.number(),
  }),
  z.object({
    type: z.literal("flat"),
    value: z.number(),
  }),
]);
