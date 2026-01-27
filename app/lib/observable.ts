export abstract class Observable<T> {
  private listeners: Array<(data: T) => void> = [];

  public subscribe(listener: (data: T) => void): void {
    this.listeners.push(listener);
  }

  public unsubscribe(listener: (data: T) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  protected notifyListeners(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }
}
