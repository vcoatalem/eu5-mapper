import { CopyrightNotice } from "@/app/components/copyrightNotice.component";
import { CountryStats } from "@/app/components/countryStatsComponent";
import { ImportExportGameState } from "@/app/components/importExportGameState.component";
import { MainActionsBar } from "@/app/components/mainActionsBar.component";
import { Modal } from "@/app/lib/modal/modal.component";
import { HashHelper } from "@/app/lib/utils/hash.helper";
import { useGameDataVersion } from "@/app/[version]/version.guard";
import buttonStyles from "@/app/styles/button.module.css";
import { useMemo, useState } from "react";
import { AiOutlineQuestionCircle } from "react-icons/ai";
import { CiCircleQuestion } from "react-icons/ci";

export function Help({ className = "" }: { className?: string }) {
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const version = useGameDataVersion();
  const versionUnderscored = version.replaceAll(".", "_");
  const gitHash = useMemo(() => HashHelper.getGitHash(), []);
  const s3url = useMemo(
    () =>
      `https://eu5-mapapp.s3.eu-west-1.amazonaws.com/test-results/${gitHash}/${versionUnderscored}/index.html`,
    [gitHash, versionUnderscored],
  );

  return (
    <>
      <button
        className={[
          className,
          buttonStyles.simpleButton,
          modalIsOpen ? buttonStyles.active : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => setModalIsOpen(true)}
      >
        <p className="flex flex-row items-center">
          <CiCircleQuestion color="white" size={24}></CiCircleQuestion>{" "}
          <span className="ml-1 hidden md:block">Help</span>
        </p>
      </button>

      <Modal isOpen={modalIsOpen} onClose={() => setModalIsOpen(false)}>
        <div className="w-full max-h-[50vh]">
          <div className="max-h-[50vh] overflow-y-auto flex flex-col gap-2">
            <h3 className="text-yellow-500">
              <b>EU5 Mapper</b> is a helping tool for Europa Universalis 5 to
              help vizualise how proximity inside countries.
            </h3>

            <hr className="mb-4 mt-1 border-stone-600 border-1"></hr>

            <div className="flex flex-col bg-blue-500/20 rounded-md px-2 py-1">
              <p>
                - The proximity computation algorithm was created by
                reverse-engineering most of the game's mechanics.
              </p>
              <p>
                - While it is a good approximation, it may not be entirely
                accurate.
              </p>
              <p className="mr-16">
                - Automated tests are run whenever the algorithm changes to
                compare in-app results with in-game proximity computation, to
                make sure the app does not stray too far from the truth.
              </p>

              <hr className="border-stone-500 mt-2"></hr>
              <a
                href={s3url}
                target="_blank"
                className=" flex items-center h-full w-full gap-1 mt-2 text-md "
              >
                <AiOutlineQuestionCircle size={24} color="white" />
                <span className="text-sm hover:text-yellow-500">
                  See the latest performance report for version{" "}
                  <b className="text-stone-400">{version}</b>
                </span>
              </a>
            </div>

            <div className="flex flex-row mt-4 items-center">
              <div className="mr-20 text-stone-400">
                Use the toolbar to interact with the game: changing capital,
                creating buildings, roads, advances, ...
              </div>
              <div className="bg-blue-500/20 rounded-md px-2 py-1">
                <MainActionsBar isTutorial={true}></MainActionsBar>
              </div>
            </div>

            <div className="flex flex-row mt-4 items-center">
              <div className="bg-blue-500/20 rounded-md px-2 py-2">
                <ImportExportGameState
                  isTutorial={true}
                ></ImportExportGameState>
              </div>
              <span className="ml-6 text-stone-400">
                Use the import/export feature save your setup, and resume it
                next time
              </span>
            </div>

            <button
              className={[buttonStyles.simpleButton, "w-32 mx-auto mt-4"].join(
                " ",
              )}
              onClick={() => setModalIsOpen(false)}
            >
              OK
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
