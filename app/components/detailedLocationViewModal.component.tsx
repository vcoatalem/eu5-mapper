import { useContext } from "react";
import { ModalInstanceContext } from "../lib/modal/modal.component";

export function DetailedLocationViewModal() {
  const modalInstanceContext = useContext(ModalInstanceContext);
  if (!modalInstanceContext) {
    throw new Error(
      "[DetailedLocationViewModal] must be used within a ModalInstanceContext provider",
    );
  }
  return <div className="h-[90vh] w-[90vw]">TODO</div>;
}
