"use client";

import { createContext, useCallback, useMemo, useState } from "react";

interface IModalProviderContext {
  modalRoot: HTMLElement | null;
}

export const ModalProviderContext =
  createContext<IModalProviderContext | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modalRoot, setModalRoot] = useState<HTMLElement | null>(null);
  const setModalRootRef = useCallback((el: HTMLDivElement | null) => {
    setModalRoot(el);
  }, []);

  const value = useMemo(() => ({ modalRoot }), [modalRoot]);

  return (
    <ModalProviderContext.Provider value={value}>
      <div id="modal-root" ref={setModalRootRef} />
      {children}
    </ModalProviderContext.Provider>
  );
}
