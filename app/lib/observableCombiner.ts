import { Observable } from "./observable";

// Sentinel for uninitialized values
const UNSET = Symbol("unset");

export type CombinedEmission<T extends any[]> = { values: T; changedIndex: number };

export class ObservableCombiner<T extends any[]> extends Observable<CombinedEmission<T>> {
  private latestValues: any[];
  private unsubscribes: Array<() => void> = [];
  private initialized: boolean[];
  private lastChangedIndex: number | null = null;

  constructor(observables: { [K in keyof T]: Observable<T[K]> }) {
    super();
    this.latestValues = Array(observables.length).fill(UNSET);
    this.initialized = Array(observables.length).fill(false);
    // Don't emit until all are initialized
    this.subject = null as unknown as CombinedEmission<T>;

    observables.forEach((obs, idx) => {
      const unsubscribe = obs.subscribe((data: T[typeof idx]) => {
        this.latestValues[idx] = data;
        this.initialized[idx] = true;
        this.lastChangedIndex = idx;
        this.updateSubject();
      });
      this.unsubscribes.push(unsubscribe);
    });
  }

  private updateSubject() {
    if (this.initialized.every(Boolean) && this.lastChangedIndex !== null) {
      // All values are set, emit tuple and changed index
      this.subject = {
        values: [...this.latestValues] as T,
        changedIndex: this.lastChangedIndex,
      };
      this.notifyListeners();
    }
  }

  /**
   * Unsubscribes from all source observables. Call when disposing this combiner.
   */
  public dispose() {
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
  }
}
