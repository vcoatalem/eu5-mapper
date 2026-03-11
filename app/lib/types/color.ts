import { z } from "zod";

export const ZodHexColor = z
  .string()
  .regex(
    /^(?:#)?(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/,
    "Invalid hex color format",
  )
  .transform((str) => str.replaceAll("#", ""))
  .brand<"HexColor">();

export type HexColor = z.infer<typeof ZodHexColor>;

export const ZodColorToLocIdentifierMap = z.record(ZodHexColor, z.string());

export type ColorToLocIdentifierMap = z.infer<
  typeof ZodColorToLocIdentifierMap
>;
