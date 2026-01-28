export abstract class Observable<T> {
  protected subject: T = null as T; // initialized by subclass constructor
  private listeners: Array<(data: T) => void> = [];

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
    for (const listener of this.listeners) {
      listener(this.subject);
    }
  }

  public getSnapshot(): T {
    return this.subject; //todo: deep copy
  }
}
