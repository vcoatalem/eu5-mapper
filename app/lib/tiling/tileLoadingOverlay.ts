"use client";

import { RefObject, useCallback, useEffect, useRef } from "react";

export const TILE_LOADING_OVERLAY_CLASS =
  "absolute inset-0 grid place-items-center pointer-events-none";
export const TILE_LOADING_SPINNER_CLASS =
  "inline-block rounded-full border-2 border-gray-200 border-t-gray-700 animate-spin";
export const TILE_LOADING_SPINNER_SIZE_RATIO = 1 / 4;

// Plain-DOM helper (no React) loading overlay - to be used both in React component or non React dom manipulation loops
// This is the single authority on the overlay's markup/visuals — both TileVirtualizationManager
// (calls this directly, plain DOM) and useTileLoadingOverlay below (React) go through it, so
// there's exactly one definition, never two representations of the same spinner to keep in sync.
export function createTileLoadingOverlay(size: number): HTMLDivElement {
  const el = document.createElement("div");
  el.className = TILE_LOADING_OVERLAY_CLASS;

  const spinnerSize = size * TILE_LOADING_SPINNER_SIZE_RATIO;
  const spinner = document.createElement("span");
  spinner.className = TILE_LOADING_SPINNER_CLASS;
  spinner.style.width = `${spinnerSize}px`;
  spinner.style.height = `${spinnerSize}px`;

  el.appendChild(spinner);
  return el;
}

// React wrapper around createTileLoadingOverlay: attaches the overlay into `containerRef.current`
// on mount (containerRef's element must be position:relative or similar for the overlay's
// inset-0 to land correctly), and returns `{ remove, markError }` so the caller can end its
// lifecycle imperatively (e.g. from inside a fetch .then/.catch) instead of routing "is it done
// loading" through React state just to conditionally render a second copy of this markup.
export function useTileLoadingOverlay(
  containerRef: RefObject<HTMLElement | null>,
  size: number,
): { remove: () => void; markError: () => void } {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const remove = useCallback(() => {
    overlayRef.current?.remove();
    overlayRef.current = null;
  }, []);

  const markError = useCallback(() => {
    overlayRef.current?.classList.add("opacity-40");
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const overlay = createTileLoadingOverlay(size);
    container.appendChild(overlay);
    overlayRef.current = overlay;
    return remove;
  }, [containerRef, size, remove]);

  return { remove, markError };
}
