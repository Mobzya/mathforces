type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const globalCache = globalThis as typeof globalThis & {
  mathforcesCache?: Map<string, CacheEntry<unknown>>;
  mathforcesPendingCache?: Map<string, Promise<unknown>>;
};
const entries =
  globalCache.mathforcesCache ??
  (globalCache.mathforcesCache = new Map<string, CacheEntry<unknown>>());
const pendingEntries =
  globalCache.mathforcesPendingCache ??
  (globalCache.mathforcesPendingCache = new Map<string, Promise<unknown>>());

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const existing = entries.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > Date.now()) return existing.value;
  const pending = pendingEntries.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const request = load().then((value) => {
    if (pendingEntries.get(key) === request) {
      entries.set(key, { expiresAt: Date.now() + ttlMs, value });
    }
    return value;
  });
  pendingEntries.set(key, request);
  try {
    return await request;
  } finally {
    if (pendingEntries.get(key) === request) pendingEntries.delete(key);
  }
}

export function invalidateCache(prefix: string) {
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
  for (const key of pendingEntries.keys()) {
    if (key.startsWith(prefix)) pendingEntries.delete(key);
  }
}
