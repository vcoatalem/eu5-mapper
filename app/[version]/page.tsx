"use client";

import dynamic from "next/dynamic";

const WorldMapComponent = dynamic(() => import("@/app/components/worldMap.component"), {
  ssr: false,
});

export default function VersionedPage() {
  return <WorldMapComponent />;
}
