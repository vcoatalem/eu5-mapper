"use client";

import React, { useEffect, useRef } from "react";
import {
  actionEventDispatcher,
  type HoverActionType,
  type ClickActionType,
} from "./actionEventDispatcher";
import type { ILocationIdentifier } from "./types/general";

export type LocationsInput = (
  e?: MouseEvent,
) => ILocationIdentifier | ILocationIdentifier[] | null;

export type HoverConfig = {
  type?: HoverActionType;
  prolongedDelay?: number;
};

export type ClickConfig = {
  type?: ClickActionType;
};

export type ActionSourceProps<T extends HTMLElement = HTMLElement> = {
  locations: LocationsInput;
  hover?: HoverConfig;
  click?: ClickConfig;
  children: React.ReactElement<{ ref?: React.Ref<T> }>;
};

// Merge an existing child ref with our internal ref so both receive the DOM element
function mergeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return (value: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") {
        ref(value);
      } else {
        try {
          // MutableRefObject
          (ref as React.MutableRefObject<T | null>).current = value;
        } catch {
          // ignore if it's not assignable
        }
      }
    }
  };
}

export function ActionSource<T extends HTMLElement = HTMLElement>({
  locations,
  hover,
  click,
  children,
}: ActionSourceProps<T>) {
  const internalRef = useRef<T | null>(null);

  useEffect(() => {
    const el = internalRef.current as unknown as HTMLElement | null;
    if (!el) return;

    if (hover) {
      actionEventDispatcher.registerHoverActionSource(
        el,
        locations,
        hover.type ?? null,
        hover.prolongedDelay ?? 1500,
      );
    }

    if (click) {
      actionEventDispatcher.registerClickActionSource(
        el,
        (e) => {
          const result = locations(e);
          if (Array.isArray(result)) {
            return result[0] ?? null;
          }
          return result;
        },
        click.type ?? null,
      );
    }

    return () => {
      actionEventDispatcher.clearEventListenersForElement(el);
    };
    // We intentionally do not include `hover` / `click` objects in deps to
    // avoid re-registering handlers on every render; callers should pass
    // stable values (or memoized callbacks) for `locations` when needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations]);

  const child = React.Children.only(children) as React.ReactElement<{
    ref?: React.Ref<T>;
  }>;
  const combinedRef = mergeRefs(
    (child as any).ref as React.Ref<T> | undefined,
    internalRef,
  );

  return React.cloneElement(child, { ref: combinedRef });
}
