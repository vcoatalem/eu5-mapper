export const worldMapConfig = {
  width: 16384,
  height: 8192,
};

export const TILE_SIZE = 512;
export const COLS = worldMapConfig.width / TILE_SIZE; // 32
export const ROWS = worldMapConfig.height / TILE_SIZE; // 16
export const DETAIL_TILE_MIN_ZOOM = 0.5;
