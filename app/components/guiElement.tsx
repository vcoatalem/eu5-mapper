import styles from "../styles/Gui.module.css";

export function GuiElement({ children, className = "" }: { children: React.ReactNode; className?: string  })
 {
  return <div className={`${styles.guiElement} ${className}`}>{children}</div>;
 }