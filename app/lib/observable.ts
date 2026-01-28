export abstract class Observable<T> {
  protected subject: T = null as T; // initialized by subclass constructor
  private listeners: Array<(data: T) => void> = [];
  private cachedSnapshot: T | null = null;

  public subscribe(listener: (data: T) => void): () => void {
    this.listeners.push(listener);
    return () => this.unsubscribe(listener);
  }

  public unsubscribe(listener: (data: T) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  protected notifyListeners(): void {
    this.cachedSnapshot = { ...this.subject } as T; // Create new snapshot when data changes
    for (const listener of this.listeners) {
      listener(this.subject);
    }
  }

  public getSnapshot(): T {
    if (this.cachedSnapshot === null) {
      this.cachedSnapshot = { ...this.subject } as T;
    }
    return this.cachedSnapshot;
  }

  /**
   * Returns a new Observable that emits values only after a specified delay without new emissions.
   */
  public debounce(ms: number): Observable<T> {
    const source = this;
    return new (class extends Observable<T> {
      private timeout: any = null;
      constructor() {
        super();
        source.subscribe((value) => {
          if (this.timeout) clearTimeout(this.timeout);
          this.timeout = setTimeout(() => {
            this.subject = value;
            this.notifyListeners();
          }, ms);
        });
      }
    })();
  }
}
