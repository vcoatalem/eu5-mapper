import { Observable } from "./observable";

export class Subject<T> extends Observable<T> {
  constructor() {
    super();
  }

  public emit(value: T): void {
    this.subject = { ...value } as T;
    this.notifyListeners();
  }
}
