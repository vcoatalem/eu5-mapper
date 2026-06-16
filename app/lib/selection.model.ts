import { Observable } from "./observable";
import type { LocationIdentifier } from "./types/general";
import type { Coordinate } from "./types/coordinate";

export interface ISelectionState {
  location: LocationIdentifier | null;
  mouseCoordinate: Coordinate | null;
}

export class SelectionModel extends Observable<ISelectionState> {
  constructor() {
    super();
    this.subject = { location: null, mouseCoordinate: null };
  }
  update(location: LocationIdentifier | null, mouseCoordinate: Coordinate | null): void {
    this.subject = { location, mouseCoordinate };
    this.notifyListeners();
  }
  clear(): void {
    this.update(null, null);
  }
}
