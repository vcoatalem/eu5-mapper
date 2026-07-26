export type TileLayer = "terrain" | "border";

export interface TileUrlGrid {
  terrain: string[][]; // [row][col] -> full CDN URL
  border: string[][];
}
