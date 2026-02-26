import { Subject } from "./subject";
import { ICoordinate, ILocationIdentifier } from "./types/general";

type HoverEventPayload = {
  locations: ILocationIdentifier[];
  type: "search" | null;
  mouseCoordinate: ICoordinate | null;
};

type ClickEventPayload = {
  locations: ILocationIdentifier[];
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


  public init() {
    this.hoveredLocation.emit({ locations: [], type: null, mouseCoordinate: null });
    this.prolongedHoverLocation.emit({ locations: [], type: null, mouseCoordinate: null });
    this.clickedLocationSource.emit({ locations: [], type: null, mouseCoordinate: null });
  }

  private static arraysEqual(a: ILocationIdentifier[], b: ILocationIdentifier[]): boolean {
    return a.length === b.length && a.every((loc, i) => loc === b[i]);
  }

  private clickedMouseDownLocation: {
    locations: ILocationIdentifier[];
    coordinate: ICoordinate | null;
  } = { locations: [], coordinate: null };
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
    ) => ILocationIdentifier[] | Promise<ILocationIdentifier[] | null> | null,
    type: "search" | null = null,
    prolongedHoverDelay: number = 1500,
  ) {
    const mouseMoveHandler = async (e: MouseEvent) => {
      const coordinate: ICoordinate = { x: e.clientX, y: e.clientY };
      const locationResult = await Promise.resolve(locationNameFn(e));
      const locationNames = locationResult ?? [];

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
    const mouseOutHandler = async (e: MouseEvent) => {
      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer);
        this.hoverTimer = null;
      }
      const locationResult = await Promise.resolve(locationNameFn(e));
      const locationNames = locationResult ?? [];

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
  }

  public registerClickActionSource(
    element: HTMLElement,
    locationNameFn: (
      e: MouseEvent,
    ) =>
      | ILocationIdentifier[]
      | Promise<ILocationIdentifier[]>,
    type: "acquire" | "goto" | null = null, // TODO: add more actions as needed
  ) {
    const maximumClickDistance = 5; // pixels
    const mouseDownHandler = async (e: MouseEvent) => {
      const locations = await Promise.resolve(locationNameFn(e));
      this.clickedMouseDownLocation = {
        locations: Array.isArray(locations) ? locations : [],
        coordinate: { x: e.clientX, y: e.clientY },
      };
    };
    const mouseUpHandler = async (e: MouseEvent) => {
      const locations = await Promise.resolve(locationNameFn(e));
      const locs = Array.isArray(locations) ? locations : [];
      const prev = this.clickedMouseDownLocation;
      const distance =
        Math.abs(e.clientX - (prev.coordinate?.x ?? 0)) +
        Math.abs(e.clientY - (prev.coordinate?.y ?? 0));
      if (
        prev.locations.length >= 0 &&
        ActionEventDispatcher.arraysEqual(prev.locations, locs) &&
        distance <= maximumClickDistance
      ) {
        this.clickedLocationSource.emit({
          locations: locs,
          type,
          mouseCoordinate: { x: e.clientX, y: e.clientY },
        });
      }
      this.clickedMouseDownLocation = { locations: [], coordinate: null };
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

  public dispatchClickAction(
    type: ClickActionType,
    locations: ILocationIdentifier[],
    mouseCoordinate: ICoordinate | null,
  ) {
    this.clickedLocationSource.emit({ locations, type, mouseCoordinate });
  }

  public dispatchHoverAction(type: HoverActionType, locations: ILocationIdentifier[], mouseCoordinate: ICoordinate | null) {
    this.hoveredLocation.emit({ locations, type, mouseCoordinate });
  }
}

export const actionEventDispatcher = new ActionEventDispatcher();
