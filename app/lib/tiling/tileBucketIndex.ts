import { MapPoint } from "@/app/lib/types/coordinateSpaces";
import { LocationIdentifier } from "@/app/lib/types/general";
import { mapToTileId, tileKey } from "@/app/lib/tiling/tileMath";
import { getOrCreate } from "@/app/lib/utils/mapUtils";

export class TileBucketIndex {
  private buckets = new Map<string, Map<LocationIdentifier, MapPoint[]>>();
  private byLocation = new Map<LocationIdentifier, MapPoint[]>();

  ingest(loc: LocationIdentifier, coords: MapPoint[]): void {
    this.byLocation.set(loc, coords);
    for (const c of coords) {
      const key = tileKey(mapToTileId(c));
      const perTile = getOrCreate(
        this.buckets,
        key,
        () => new Map<LocationIdentifier, MapPoint[]>(),
      );
      getOrCreate(perTile, loc, () => []).push(c);
    }
  }

  getByTile(key: string): Map<LocationIdentifier, MapPoint[]> | undefined {
    return this.buckets.get(key);
  }

  coordsOf(loc: LocationIdentifier): MapPoint[] {
    return this.byLocation.get(loc) ?? [];
  }

  has(loc: LocationIdentifier): boolean {
    return this.byLocation.has(loc);
  }
}
