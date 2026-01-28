import { Observable } from "./observable";

// Sentinel for uninitialized values
const UNSET = Symbol("unset");

export class ObservableCombiner<T extends any[]> extends Observable<T> {
  private latestValues: any[];
  private unsubscribes: Array<() => void> = [];
  private initialized: boolean[];

  constructor(observables: { [K in keyof T]: Observable<T[K]> }) {
    super();
    this.latestValues = Array(observables.length).fill(UNSET);
    this.initialized = Array(observables.length).fill(false);
    // Don't emit until all are initialized
    this.subject = null as unknown as T;

    observables.forEach((obs, idx) => {
      const unsubscribe = obs.subscribe((data: T[typeof idx]) => {
        this.latestValues[idx] = data;
        this.initialized[idx] = true;
        this.updateSubject();
      });
      this.unsubscribes.push(unsubscribe);
    });
  }

  private updateSubject() {
    if (this.initialized.every(Boolean)) {
      // All values are set, emit tuple
      this.subject = [...this.latestValues] as T;
      this.notifyListeners();
    }
  }

  public dispose() {
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
  }
}
