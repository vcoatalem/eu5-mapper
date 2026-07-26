import { Observable } from "./observable";
import { CombinedEmission, ObservableCombiner } from "./observableCombiner";

export class DisposableBag {
  private cleanups: Array<() => void> = [];
  private disposed = false;

  createManagedSubscription = <T>(
    source: Observable<T>,
    cb: (data: T) => void,
  ): void => {
    const unsub = source.subscribe(cb);
    if (this.disposed) {
      unsub();
      return;
    }
    this.cleanups.push(unsub);
  };

  createManagedEventListener = <K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K,
    handler: (e: HTMLElementEventMap[K]) => void,
  ): void => {
    if (this.disposed) return; // don't even attach — nothing to undo later
    element.addEventListener(type, handler as EventListener);
    this.cleanups.push(() =>
      element.removeEventListener(type, handler as EventListener),
    );
  };

  createManagedCombinerSubscription = <T extends unknown[]>(
    observables: { [K in keyof T]: Observable<T[K]> },
    cb: (data: CombinedEmission<T>) => void,
    debounceMs?: number,
  ): void => {
    const combiner = new ObservableCombiner<T>(observables);
    const source =
      debounceMs != null ? combiner.debounce(debounceMs) : combiner;
    const unsub = source.subscribe(cb);
    const cleanup = () => {
      unsub();
      combiner.dispose();
    };
    if (this.disposed) {
      cleanup();
      return;
    }
    this.cleanups.push(cleanup);
  };

  // GameEngine-only — not part of ModelInitParams.
  manage = (cleanup: () => void): void => {
    if (this.disposed) {
      cleanup();
      return;
    }
    this.cleanups.push(cleanup);
  };

  dispose(): void {
    this.disposed = true;
    this.cleanups.forEach((c) => c());
    this.cleanups = [];
  }
}
