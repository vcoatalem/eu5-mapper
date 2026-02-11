import { Subject } from "./subject";
import { ICoordinate, ILocationIdentifier } from "./types/general";

type HoverEventPayload = {
  locations: ILocationIdentifier[];
  type: "search" | null;
  mouseCoordinate: ICoordinate | null;
};

type ClickEventPayload = {
  location: ILocationIdentifier | null;
  type: "acquire" | "goto" | null; // add more types as needed
  mouseCoordinate: ICoordinate | null;
};

export type HoverActionType = HoverEventPayload["type"];
export type ClickActionType = ClickEventPayload["type"];

export class ActionEventDispatcher {
  public hoveredLocation: Subject<HoverEventPayload> =
    new Subject<HoverEventPayload>();

  public prolongedHoverLocation: Subject<HoverEventPayload> =
    new Subject<HoverEventPayload>();

  public clickedLocationSource: Subject<ClickEventPayload> =
    new Subject<ClickEventPayload>();

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
    locationNameFn: (
      e: MouseEvent,
    ) => ILocationIdentifier | ILocationIdentifier[] | null,
    type: "search" | null = null,
    prolongedHoverDelay: number = 1500,
  ) {
    const mouseMoveHandler = (e: MouseEvent) => {
      const coordinate: ICoordinate = { x: e.clientX, y: e.clientY };
      const locationResult = locationNameFn(e);
      const locationNames = Array.isArray(locationResult)
        ? locationResult
        : locationResult !== null
          ? [locationResult]
          : [];

      const currentLocations =
        this.hoveredLocation.getSnapshot()?.locations ?? [];
      // Check if locations are the same (order-independent comparison)
      const locationsEqual =
        locationNames.length === currentLocations.length &&
        locationNames.every((loc) => currentLocations.includes(loc)) &&
        currentLocations.every((loc) => locationNames.includes(loc));

      if (locationsEqual) {
        return;
      } else {
        if (this.hoverTimer) {
          clearTimeout(this.hoverTimer);
          this.hoverTimer = null;
        }
      }

      const prolongedHoverLocations =
        this.prolongedHoverLocation.getSnapshot()?.locations ?? [];
      // Clear prolonged hover if it doesn't match current hover
      const prolongedMatches =
        prolongedHoverLocations.length === locationNames.length &&
        prolongedHoverLocations.every((loc) => locationNames.includes(loc)) &&
        locationNames.every((loc) => prolongedHoverLocations.includes(loc));

      if (prolongedHoverLocations.length > 0 && !prolongedMatches) {
        this.prolongedHoverLocation.emit({
          locations: [],
          type: null,
          mouseCoordinate: null,
        });
      }

      this.hoveredLocation.emit({
        locations: locationNames,
        type,
        mouseCoordinate: coordinate,
      });
      this.hoverTimer = setTimeout(() => {
        this.prolongedHoverLocation.emit({
          locations: locationNames,
          type,
          mouseCoordinate: coordinate,
        });
      }, prolongedHoverDelay);
    };
    const mouseOutHandler = (e: MouseEvent) => {
      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer);
        this.hoverTimer = null;
      }
      const locationResult = locationNameFn(e);
      const locationNames = Array.isArray(locationResult)
        ? locationResult
        : locationResult !== null
          ? [locationResult]
          : [];

      const currentLocations =
        this.hoveredLocation.getSnapshot()?.locations ?? [];
      const locationsEqual =
        locationNames.length === currentLocations.length &&
        locationNames.every((loc) => currentLocations.includes(loc)) &&
        currentLocations.every((loc) => locationNames.includes(loc));

      if (locationsEqual) {
        this.hoveredLocation.emit({
          locations: [],
          type: null,
          mouseCoordinate: null,
        });
        const prolongedLocations =
          this.prolongedHoverLocation.getSnapshot()?.locations ?? [];
        const prolongedMatches =
          prolongedLocations.length === locationNames.length &&
          prolongedLocations.every((loc) => locationNames.includes(loc)) &&
          locationNames.every((loc) => prolongedLocations.includes(loc));

        if (prolongedMatches) {
          this.prolongedHoverLocation.emit({
            locations: [],
            type: null,
            mouseCoordinate: null,
          });
        }
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
          mouseCoordinate: { x: e.clientX, y: e.clientY },
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
        element.removeEventListener(type, handler as EventListener);
      });
      this.elementEventHandlers.delete(element);
      /*       console.log(
        `[ActionEventDispatcher] clearEventListenersForElement: total event listeners stored: ${Array.from(this.elementEventHandlers.values()).reduce((acc, arr) => acc + arr.length, 0)}`,
      ); */
    }
  }
}

export const actionEventDispatcher = new ActionEventDispatcher();
