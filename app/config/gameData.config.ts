import { z } from "zod";

export const GAME_DATA_CDN_URL = "https://d20jmbxuxgwnbv.cloudfront.net";

/**
 * This commit sha represents a version of the game data package created by https://github.com/vcoatalem/eu5-mapapp-data-processing
 * Whenever the data processing changes in a way that affects the output files, or a new game version is released, this should be updated
 */
export const GAME_DATA_PACKAGE_SHA = "e33ec78be90c35bfed79be33973405b04284e776";

export const ZodGameDataVersion = z.enum(["1.0.11", "1.1.9"]);

export const ALL_GAME_DATA_OPTIONS = ZodGameDataVersion.options;

export type GameDataVersion = z.infer<typeof ZodGameDataVersion>;
