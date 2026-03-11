"use client";

import {
  GameDataVersion,
  ZodGameDataVersion,
} from "@/app/config/gameData.config";
import { useParams } from "next/navigation";

export function parseGameDataVersion(version: string): GameDataVersion {
  return ZodGameDataVersion.parse(version);
}

export function useGameDataVersion(): GameDataVersion {
  const params = useParams<{ version: string }>();
  return parseGameDataVersion(params.version);
}
