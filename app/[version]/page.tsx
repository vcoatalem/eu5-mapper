"use client";

import dynamic from "next/dynamic";
import { TooltipProvider } from "../lib/tooltip/tooltip.provider";

const WorldMapComponent = dynamic(
  () => import("@/app/components/worldMap.component"),
  {
    ssr: false,
  },
);

export default function VersionedPage() {
  return (
    <TooltipProvider>
      <WorldMapComponent />
    </TooltipProvider>
  );
}
