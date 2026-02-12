"use client";

import dynamic from "next/dynamic";
import { ModalProvider } from "../lib/modal/modal.provider";
import { TooltipProvider } from "../lib/tooltip/tooltip.provider";

const WorldMapComponent = dynamic(
  () => import("@/app/components/worldMap.component"),
  {
    ssr: false,
  },
);

export default function VersionedPage() {
  return (
    <ModalProvider>
      <TooltipProvider>
        <WorldMapComponent />
      </TooltipProvider>
    </ModalProvider>
  );
}
