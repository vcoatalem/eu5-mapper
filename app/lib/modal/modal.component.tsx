"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./modal.module.css";

interface IModalContext {
  close: () => void;
}

const ModalContext = createContext<IModalContext | null>(null);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("useModal must be used within a Modal");
  }
  return ctx;
}

interface IModalProps {
  isOpen: boolean;
  onClose: () => void;
  preventClose?: boolean;
  children: React.ReactNode;
}

export function Modal(props: IModalProps) {
  const { isOpen, onClose, preventClose, children } = props;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // ssr guard to avoid using portal on server render (not relevant in world map component that has disabled SSR, but playing it safe)
  }, []);

  if (!isOpen || !mounted) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (preventClose) return;
    if (e.target !== e.currentTarget) return;
    onClose();
  };

  const portalTarget = document.body; // todo: target a precise root instead ?

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div
        className={styles.container}
        onClick={(e) => {
          e.stopPropagation();
        }}
        role="dialog"
        aria-modal="true"
      >
        <ModalContext.Provider value={{ close: onClose }}>
          {children}
        </ModalContext.Provider>
      </div>
    </div>,
    portalTarget,
  );
}
