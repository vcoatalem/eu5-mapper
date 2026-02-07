import styles from "../styles/Gui.module.css";

export function GuiElement({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`${styles.guiElement} ${className}`} style={style}>
      {children}
    </div>
  );
}