import { VersionsManifest } from "@/app/lib/types/versionsManifest";
import { VersionResolver } from "@/app/lib/versionResolver";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";


export function GameVersionSelector() {
  const [manifest, setManifest] = useState<VersionsManifest | null>(null);
  const currentVersion = useParams().version as string;
  useEffect(() => {
    const resolver = new VersionResolver();
    resolver.loadVersionsManifest().then((manifest) => setManifest(manifest));
  }, [])

  if (!manifest) {
    return <></>;
  }
  return (
    <div className="rounded-md border-stone-400 border-1 p-1 flex flex-row items-center gap-1">
      <span className="text-stone-400 text-sm">Game Version:</span>
      <select value={currentVersion} className="hover:bg-stone-600 cursor-pointer text-white" onChange={(e) => {
        window.open(`/${e.target.value}`, "_blank");
      }}>
        
        {manifest.versions.map((version) => (
          <option key={version} value={version} >{version}</option>
        ))}
      </select>
    </div>
  );
}