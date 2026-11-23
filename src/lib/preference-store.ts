type Listener = () => void;

interface PreferenceStoreOptions<T extends string> {
  key: string;
  fallback: T;
  validate: (value: unknown) => value is T;
}

export interface PreferenceStore<T extends string> {
  subscribe: (listener: Listener) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (value: T) => void;
}

/**
 * A tiny external store backed by localStorage, designed for `useSyncExternalStore`.
 * Syncs across tabs via the `storage` event and falls back to memory when storage is blocked.
 */
export function createPreferenceStore<T extends string>({
  key,
  fallback,
  validate,
}: PreferenceStoreOptions<T>): PreferenceStore<T> {
  const listeners = new Set<Listener>();
  let memoryValue: T = fallback;

  const getSnapshot = (): T => {
    try {
      const stored = window.localStorage.getItem(key);
      return validate(stored) ? stored : memoryValue;
    } catch {
      return memoryValue;
    }
  };

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  const set = (value: T) => {
    memoryValue = value;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage unavailable (private mode / blocked) – keep the in-memory value.
    }
    listeners.forEach((listener) => listener());
  };

  return { subscribe, getSnapshot, getServerSnapshot: () => fallback, set };
}
