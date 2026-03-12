import { useParams } from "next/navigation";
import styles from "@/app/styles/button.module.css";
import { gameStateController } from "@/app/lib/gameState.controller";
import { useCallback, useState, useSyncExternalStore } from "react";
import { Modal } from "@/app/lib/modal/modal.component";
import { useGameDataVersion } from "@/app/[version]/version.guard";
import posthog from "posthog-js";
import { IoMdDownload } from "react-icons/io";
import { MdFileUpload } from "react-icons/md";

interface IImportExportGameStateProps {
  isTutorial?: boolean;
}

export function ImportExportGameState(props: IImportExportGameStateProps) {
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );
  const [showImportModal, setShowImportModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useGameDataVersion();

  const readFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = (event) => {
        posthog.capture("import_game_state", {
          version,
        });
        try {
          const content = event.target?.result as string;
          gameStateController.loadFile(content, version);
          setShowImportModal(false);
          setError(null);
        } catch (error) {
          console.error("Failed to parse JSON:", error);
          setError(String(error));
        }
      };

      reader.onerror = () => {
        console.error("Failed to read file");
      };

      reader.readAsText(file);
    },
    [version],
  );

  if (!version) {
    throw new Error("[ImportExportGameState] version not found");
  }
  return (
    <div className="flex flex-row items-center gap-2">
      <button
        className={[
          styles.simpleButton,
          "flex flex-row gap-1 items-center",
        ].join(" ")}
        onClick={() => {
          if (props.isTutorial) return;
          setShowImportModal(true);
        }}
      >
        <MdFileUpload size={24} color="white" />
        <span className="hidden md:block">Load</span>
      </button>
      <button
        disabled={!gameState.capitalLocation}
        className={[
          styles.simpleButton,
          "flex flex-row items-center gap-1",
        ].join(" ")}
        onClick={() => {
          if (props.isTutorial) return;
          posthog.capture("export_game_state", {
            version,
          });
          gameStateController.download();
        }}
      >
        <IoMdDownload size={24} color="white" />
        <span className="hidden md:block">Save</span>
      </button>
      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)}>
        <div className="min-h-[30vh] min-w-[400px] flex flex-col gap-2 items-center">
          <h1 className="font-bold text-xl">Import a Game State file</h1>
          <span className="text-stone-600 text-center">
            {`You may import a JSON file exported through the "Save State" button`}
          </span>
          <input
            className={
              "border border-white hover:bg-stone-600 rounded-md px-2 py-1"
            }
            type="file"
            accept=".json"
            onChange={readFile}
          ></input>

          {error && (
            <div className="bg-red-100 text-red-700 p-2 rounded-md mt-2 overflow-y-auto">
              <h2 className="font-bold">Error:</h2>
              <pre className="whitespace-pre-wrap">{error}</pre>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
