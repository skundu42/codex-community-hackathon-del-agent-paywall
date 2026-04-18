import { Store } from "mppx";

import {
  deleteMppStoreValue,
  getMppStoreValue,
  putMppStoreValue,
  updateMppStoreValue,
} from "@/lib/store";

export function getMppReplayStore() {
  return Store.from({
    get(key: string) {
      return getMppStoreValue(key);
    },
    put(key: string, value: unknown) {
      return putMppStoreValue(key, value);
    },
    delete(key: string) {
      return deleteMppStoreValue(key);
    },
    update<Result>(
      key: string,
      fn: (current: unknown | null) =>
        | { op: "noop"; result: Result }
        | { op: "set"; value: unknown; result: Result }
        | { op: "delete"; result: Result },
    ) {
      return updateMppStoreValue(key, fn);
    },
  });
}
