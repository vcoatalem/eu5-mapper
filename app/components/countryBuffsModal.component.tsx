import buttonStyles from "../styles/button.module.css";
import { AppContext } from "@/app/appContextProvider";
import { useContext } from "react";

interface ICountryBuffsModal {
  onClose: () => void;
}

export function CountryBuffsModal(props: ICountryBuffsModal) {
  const { gameData } = useContext(AppContext);

  if (!gameData) {
    return <div>Loading...</div>;
  }

  console.log({templates: gameData.countryProximityBuffsTemplate});

  return (
    <div className="w-[85vw] h-[80vh]">
      <div className="h-12 w-full flex flex-row items-center">
        <button className={["ml-auto", buttonStyles.simpleButton].join(" ")} onClick={() => props.onClose()}>Close</button>
      </div>

    </div>
  )
}