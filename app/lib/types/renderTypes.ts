import { MapPoint } from "@/app/lib/types/coordinateSpaces";
import { RoadType } from "@/app/lib/types/roads";

export type ResolvedRoad = { from: MapPoint; to: MapPoint; type: RoadType };
