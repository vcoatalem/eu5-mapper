import { GAME_DATA_VERSIONS } from "@/app/config/gameData.config";
import { useParams } from "next/navigation";

export function GameVersionSelector() {
  const currentVersion = useParams().version as string;

  return (
    <div className="rounded-md border-stone-400 border px-1 py-2 flex flex-row items-center gap-1">
      <span className="text-stone-400 text-sm">Game Version:</span>
      <select
        value={currentVersion}
        className="hover:bg-stone-600 cursor-pointer text-white"
        onChange={(e) => {
          window.open(`/${e.target.value}`, "_blank");
        }}
      >
        {GAME_DATA_VERSIONS.map((version) => (
          <option key={version} value={version}>
            {version}
          </option>
        ))}
      </select>
    </div>
  );
}
