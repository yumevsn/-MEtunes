import { throttledFetch } from './httpThrottle';

export interface FetchedArt {
  format: string;
  data: Uint8Array;
}

const artCache = new Map<string, FetchedArt | null>();

export async function fetchCoverArt(releaseId: string): Promise<FetchedArt | null> {
  if (artCache.has(releaseId)) return artCache.get(releaseId) ?? null;
  try {
    const res = await throttledFetch(`https://coverartarchive.org/release/${releaseId}/front-500`);
    if (!res.ok) {
      artCache.set(releaseId, null);
      return null;
    }
    const blob = await res.blob();
    const data = new Uint8Array(await blob.arrayBuffer());
    const art: FetchedArt = { format: blob.type || 'image/jpeg', data };
    artCache.set(releaseId, art);
    return art;
  } catch {
    artCache.set(releaseId, null);
    return null;
  }
}
