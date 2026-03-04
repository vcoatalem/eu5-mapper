import { Topography, Vegetation } from "@/app/lib/types/location";
import { RoadType } from "@/app/lib/types/roads";

export function getVegetationIcon(vegetation: Vegetation): string {
  switch (vegetation) {
    case "forest":
      return "/gui/icons/vegetation_forest.png";
    case "woods":
      return "/gui/icons/vegetation_woods.png";
    case "jungle":
      return "/gui/icons/vegetation_jungle.png";
    case "desert":
      return "/gui/icons/vegetation_desert.png";
    case "farmland":
      return "/gui/icons/vegetation_farmland.png";
    case "grasslands":
      return "/gui/icons/vegetation_grasslands.png";
    case "sparse":
      return "/gui/icons/vegetation_sparse.png";
    default:
      return "/icons/question.svg";
  }
}

export function getTopographyIcon(topography: Topography): string {
  switch (topography) {
    case "hills":
      return "/gui/icons/topography_hills.png";
    case "wetlands":
      return "/gui/icons/topography_wetlands.png";
    case "mountains":
      return "/gui/icons/topography_mountains.png";
    case "plateau":
      return "/gui/icons/topography_plateau.png";
    case "ocean":
      return "/gui/icons/topography_ocean.png";
    case "coastal_ocean":
      return "/gui/icons/topography_coastal_ocean.png";
    case "narrows":
      return "/gui/icons/topography_narrows.png";
    case "inland_sea":
      return "/gui/icons/topography_ocean.png";
    case "high_lakes":
      return "/gui/icons/topography_lakes.png";
    case "flatland":
      return "/gui/icons/topography_flatland.png";
    default:
      return "/gui/icons/impassable_terrain.png";
  }
}

export function getRoadIcon(road: RoadType | null): string {
  switch (road) {
    case "gravel_road":
      return "/gui/icons/gravel_road.png";
    case "paved_road":
      return "/gui/icons/paved_road.png";
    case "modern_road":
      return "/gui/icons/modern_road.png";
    case "rail_road":
      return "/gui/icons/railroad.png";
    case null:
      return "/gui/icons/gravel_road.png";
    default:
      return "/icons/question.svg";
  }
}
