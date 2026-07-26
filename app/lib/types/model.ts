import { DisposableBag } from "@/app/lib/disposableBag";
import { Observable } from "@/app/lib/observable";

export interface ModelInitParams {
  createManagedSubscription: DisposableBag["createManagedSubscription"];
  createManagedEventListener: DisposableBag["createManagedEventListener"];
  createManagedCombinerSubscription: DisposableBag["createManagedCombinerSubscription"];
}

export interface ModelInitArgs {
  params: ModelInitParams;
}

export interface Model<T, TInitArgs extends ModelInitArgs = ModelInitArgs>
  extends Observable<T> {
  init(args: TInitArgs): void | Promise<void>;
}
