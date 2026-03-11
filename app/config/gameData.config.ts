import { z } from "zod";

export const GAME_DATA_CDN_URL = "https://d20jmbxuxgwnbv.cloudfront.net";

/**
 * This commit sha represents a version of the game data package created by https://github.com/vcoatalem/eu5-mapapp-data-processing
 * Whenever the data processing changes in a way that affects the output files, or a new game version is released, this should be updated
 */
export const GAME_DATA_PACKAGE_SHA = "4627b611d254a1edb8e64dd74e427ec66d44aeda";

export const ZodGameDataVersion = z.enum(["1.0.11", "1.1.9"]);

export const AllGameDataVersions = ZodGameDataVersion.options;

export type GameDataVersion = z.infer<typeof ZodGameDataVersion>;
