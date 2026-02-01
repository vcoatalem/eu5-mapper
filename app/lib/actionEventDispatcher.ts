import { Subject } from "./subject";
import { ICoordinate, ILocationIdentifier } from "./types/general";

export class ActionEventDispatcher {
  public hoveredLocation: Subject<{
    location: ILocationIdentifier | null;
    type: "search" | null;
  }> = new Subject<{
    location: ILocationIdentifier | null;
    type: "search" | null;
  }>();

  public prolongedHoverLocation: Subject<{
    location: ILocationIdentifier | null;
    type: "search" | null;
  }> = new Subject<{
    location: ILocationIdentifier | null;
    type: "search" | null;
  }>();

  public clickedLocationSource: Subject<{
    location: ILocationIdentifier | null;
    type: "acquire" | "goto" | null; // add more types as needed
  }> = new Subject<{
    location: ILocationIdentifier | null;
    type: "acquire" | "goto" | null;
  }>();

  private clickedMouseDownLocation: {
    location: ILocationIdentifier | null;
    coordinate: ICoordinate | null;
  } = { location: null, coordinate: null };
  private hoverTimer: NodeJS.Timeout | null = null;

  // Map to track registered event handlers for each element
  private elementEventHandlers: Map<
    HTMLElement,
    Array<{ type: string; handler: (e: MouseEvent) => unknown }>
  > = new Map();
  public registerHoverActionSource(
    element: HTMLElement,
    locationNameFn: (e: MouseEvent) => ILocationIdentifier | null,
    type: "search" | null = null,
    prolongedHoverDelay: number = 1500,
  ) {
    const mouseMoveHandler = (e: MouseEvent) => {
      const locationName = locationNameFn(e);
      if (this.hoveredLocation.getSnapshot()?.location === locationName) {
        return;
      } else {
        if (this.hoverTimer) {
          clearTimeout(this.hoverTimer);
          this.hoverTimer = null;
        }
      }
      if (
        this.prolongedHoverLocation.getSnapshot()?.location !== locationName
      ) {
        this.prolongedHoverLocation.emit({ location: null, type: null });
      }
      this.hoveredLocation.emit({ location: locationName ?? null, type });
      this.hoverTimer = setTimeout(() => {
        this.prolongedHoverLocation.emit({
          location: locationName ?? null,
          type,
        });
      }, prolongedHoverDelay);
    };
    const mouseOutHandler = (e: MouseEvent) => {
      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer);
        this.hoverTimer = null;
      }
      if (this.hoveredLocation.getSnapshot()?.location === locationNameFn(e)) {
        this.hoveredLocation.emit({ location: null, type: null });
        this.prolongedHoverLocation.emit({ location: null, type: null });
      }
    };
    element.addEventListener("mousemove", mouseMoveHandler);
    element.addEventListener("mouseout", mouseOutHandler);
    // Track handlers
    if (!this.elementEventHandlers.has(element)) {
      this.elementEventHandlers.set(element, []);
    }
    this.elementEventHandlers
      .get(element)!
      .push(
        { type: "mousemove", handler: mouseMoveHandler },
        { type: "mouseout", handler: mouseOutHandler },
      );
    /*     console.log(
      `[ActionEventDispatcher] registerHoverActionSource: total event listeners stored: ${Array.from(this.elementEventHandlers.values()).reduce((acc, arr) => acc + arr.length, 0)}`,
    ); */
  }

  public registerClickActionSource(
    element: HTMLElement,
    locationNameFn: (e: MouseEvent) => ILocationIdentifier | null,
    type: "acquire" | "goto" | null = null, // TODO: add more actions as needed
  ) {
    const maximumClickDistance = 5; // pixels
    const mouseDownHandler = (e: MouseEvent) => {
      this.clickedMouseDownLocation = {
        location: locationNameFn(e),
        coordinate: { x: e.clientX, y: e.clientY },
      };
    };
    const mouseUpHandler = (e: MouseEvent) => {
      const locationName = locationNameFn(e);
      if (
        this.clickedMouseDownLocation &&
        this.clickedMouseDownLocation?.location === locationName &&
        Math.abs(
          e.clientX -
            (this.clickedMouseDownLocation.coordinate?.x ?? 0) +
            e.clientY -
            (this.clickedMouseDownLocation.coordinate?.y ?? 0),
        ) <= maximumClickDistance
      ) {
        this.clickedLocationSource.emit({
          location: locationName ?? null,
          type,
        });
      }
      this.clickedMouseDownLocation = { location: null, coordinate: null };
    };
    element.addEventListener("mousedown", mouseDownHandler);
    element.addEventListener("mouseup", mouseUpHandler);
    // Track handlers
    if (!this.elementEventHandlers.has(element)) {
      this.elementEventHandlers.set(element, []);
    }
    this.elementEventHandlers
      .get(element)!
      .push(
        { type: "mousedown", handler: mouseDownHandler },
        { type: "mouseup", handler: mouseUpHandler },
      );
    /*     console.log(
      `[ActionEventDispatcher] registerClickActionSource: total event listeners stored: ${Array.from(this.elementEventHandlers.values()).reduce((acc, arr) => acc + arr.length, 0)}`,
    ); */
  }

  public clearEventListenersForElement(element: HTMLElement) {
    /*     console.log(
      "[ActionEventDispatcher] clearEventListenersForElement called with ",
      element,
    ); */
    const handlers = this.elementEventHandlers.get(element);
    if (handlers) {
      handlers.forEach(({ type, handler }) => {
        element.removeEventListener(type, handler as any);
      });
      this.elementEventHandlers.delete(element);
      /*       console.log(
        `[ActionEventDispatcher] clearEventListenersForElement: total event listeners stored: ${Array.from(this.elementEventHandlers.values()).reduce((acc, arr) => acc + arr.length, 0)}`,
      ); */
    }
  }
}

export const actionEventDispatcher = new ActionEventDispatcher();
