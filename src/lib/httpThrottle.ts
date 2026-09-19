// MusicBrainz asks anonymous API consumers to stay near 1 request/second.
// Cover Art Archive lives behind the same infrastructure, so we play it safe
// and funnel both through one shared, gently-paced queue.
const MIN_INTERVAL_MS = 1100;

let queue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function throttledFetch(url: string, init?: RequestInit): Promise<Response> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    return fetch(url, init);
  });
  // Swallow rejections in the queue chain itself so one failed lookup doesn't
  // wedge every request queued after it; callers still get their own promise.
  queue = run.catch(() => undefined);
  return run;
}
