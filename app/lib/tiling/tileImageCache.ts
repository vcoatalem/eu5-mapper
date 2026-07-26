// Module-level cache keyed by URL; survives Strict Mode remount, shared by every consumer
// (main map + minimap) so a tile fetched once is never re-fetched for the rest of the session.
const cache = new Map<string, Promise<ImageBitmap>>();

const MAX_CONCURRENT_FETCHES = 8;
let inFlight = 0;
const queue: Array<() => void> = [];

function runNext(): void {
  if (inFlight >= MAX_CONCURRENT_FETCHES) return;
  const next = queue.shift();
  if (!next) return;
  inFlight++;
  next();
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      task()
        .then(resolve, reject)
        .finally(() => {
          inFlight--;
          runNext();
        });
    });
    runNext();
  });
}

async function fetchTileImage(url: string): Promise<ImageBitmap> {
  return enqueue(async () => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`[tileImageCache] Failed to fetch ${url}: ${res.status}`);
    }
    const blob = await res.blob();
    return createImageBitmap(blob);
  });
}

export function getTileImage(url: string): Promise<ImageBitmap> {
  const existing = cache.get(url);
  if (existing) return existing;
  const promise = fetchTileImage(url);
  cache.set(url, promise);
  promise.catch(() => cache.delete(url)); // allow retry on next request after a failure
  return promise;
}
