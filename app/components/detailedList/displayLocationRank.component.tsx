import { ILocationDetailedViewData } from "@/app/components/detailedList/detailedLocationListModal.component";
import { gameStateController } from "@/app/lib/gameState.controller";
import { LocationRank } from "@/app/lib/types/general";
import styles from "@/app/styles/button.module.css";

export function DisplayRank(props: { data: ILocationDetailedViewData }) {
  return (
    <select
      id={props.data.baseLocationGameData.name + "-rank"}
      className={"w-content h-full outline-none " + styles.simpleButton}
      onChange={({ target }) => {
        console.log("changing location rank to " + target.value);
        gameStateController.changeLocationRank(
          props.data.baseLocationGameData.name,
          target.value as LocationRank,
        );
      }}
      value={props.data.constructibleData.rank}
      style={{ outline: "none", border: "none", appearance: "none" }}
    >
      {["rural", "town", "city"].map((rank) => (
        <option style={{ outline: "none" }} key={rank} value={rank}>
          {rank}
        </option>
      ))}
    </select>
  );
}