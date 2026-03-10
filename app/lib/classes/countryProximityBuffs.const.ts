import { ICountryProximityBuffsMetadata } from "@/app/lib/types/buffValue";
import { ICountryProximityBuffs } from "@/app/lib/types/countryProximityBuffs";

export const countryBuffsMetadata: Record<
  keyof ICountryProximityBuffs,
  ICountryProximityBuffsMetadata
> = {
  genericModifier: {
    label: "Generic proximity modifier",
    valueDefinition: {
      type: "percentage",
      description:
        "modifier applied to proximity over any kind of terrain or connection",
    },
  },
  landModifier: {
    label: "Land proximity modifier",
    valueDefinition: {
      type: "percentage",
      description: "modifier applied to proximity over land and rivers",
    },
  },
  seaWithMaritimeFlatCostReduction: {
    label: "Proximity cost with maritime presence",
    valueDefinition: {
      type: "flat",
      description: `<p>This is a flat reduction to the base proximity cost of a sea edge with a maritime presence of 100.<br/>Total flat cost of traveling on sea edge is obtained through formula:<br/> <code>costWithMaritimePresence * maritimePresence / 100 + costWithoutMaritimePresence * (1 - maritimePresence / 100)</code></p>`,
    },
  },
  seaWithoutMaritimeFlatCostReduction: {
    label: "Proximity cost without maritime presence",
    valueDefinition: {
      type: "flat",
      description: `<p>This is a flat reduction to the base proximity cost of a sea edge with a maritime presence of 0.<br/>Total flat cost of traveling on sea edge is obtained through formula:<br/> <code>costWithMaritimePresence * maritimePresence / 100 + costWithoutMaritimePresence * (1 - maritimePresence / 100)</code></p>`,
    },
  },
  portFlatCostReduction: {
    label: "Port proximity modifier",
    valueDefinition: {
      type: "flat",
      description:
        "It is applied to proximity going in and out of a harbor, with or without river. Note: not all land <-> sea connections are harbor.",
    },
  },
  mountainsMultiplier: {
    label: "Mountains multiplier",
    valueDefinition: {
      type: "percentage",
      description:
        "It is applied to proximity cost penalty applied when the source location is mountains.",
    },
  },
  plateauMultiplier: {
    label: "Plateau multiplier",
    valueDefinition: {
      type: "percentage",
      description:
        "It is applied to proximity cost penalty applied when the source location is plateau.",
    },
  },
  hillsMultiplier: {
    label: "Hills multiplier",
    valueDefinition: {
      type: "percentage",
      description:
        "It is applied to proximity cost penalty applied when the source location is hills.",
    },
  },
};
