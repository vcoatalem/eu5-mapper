import { ModalInstanceContext, useModal } from "@/app/lib/modal/modal.component";
import styles from "@/app/styles/button.module.css";
import { useContext } from "react";

export function CopyrightNotice({ className }: { className?: string }) {

    const modalContext = useContext(ModalInstanceContext);
    
    const email = "contact@victorcoatalem.com";
    return (
      <div className={`text-stone-200 flex flex-col gap-2 text-center font-mono ${className}`}>
        <p><b className="text-yellow-500">EU5 Mapper</b> <span className="text-stone-400 font-mono">© 2026</span></p>
        <p>EU5 is the property of Paradox Interactive.</p>
        <p>EU5 Mapper is an unofficial project based on EU5, not affiliated nor endorsed by Paradox Interactive.</p>
        <a className="mt-4 hover:text-blue-500" href={`mailto:${email}`}>Contact: {email}</a>
        {modalContext?.close && (
          <button className={[styles.simpleButton, "w-24 mx-auto mt-2"].join(" ")} onClick={() => modalContext?.close()}>OK</button>
        )}
      </div>
    )
}