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
    <div>
      <select value={currentVersion} className="bg-stone-800 text-white" onChange={(e) => {
        window.open(`/${e.target.value}`, "_blank");
      }}>
        {manifest.versions.map((version) => (
          <option key={version} value={version} >{version}</option>
        ))}
      </select>
    </div>
  );
}