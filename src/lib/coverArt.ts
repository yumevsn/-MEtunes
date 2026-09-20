import { throttledFetch } from './httpThrottle';

export interface FetchedArt {
  format: string;
  data: Uint8Array;
}

const artCache = new Map<string, FetchedArt | null>();

async function fetchArt(cacheKey: string, url: string): Promise<FetchedArt | null> {
  if (artCache.has(cacheKey)) return artCache.get(cacheKey) ?? null;
  try {
    const res = await throttledFetch(url);
    if (!res.ok) {
      artCache.set(cacheKey, null);
      return null;
    }
    const blob = await res.blob();
    const data = new Uint8Array(await blob.arrayBuffer());
    const art: FetchedArt = { format: blob.type || 'image/jpeg', data };
    artCache.set(cacheKey, art);
    return art;
  } catch {
    artCache.set(cacheKey, null);
    return null;
  }
}

export function fetchCoverArt(releaseId: string): Promise<FetchedArt | null> {
  return fetchArt(`release:${releaseId}`, `https://coverartarchive.org/release/${releaseId}/front-500`);
}

// A release group covers every edition of an album, so it finds art far more often than one release does.
export async function fetchAlbumArt(releaseId: string, releaseGroupId: string | null): Promise<FetchedArt | null> {
  if (releaseGroupId) {
    const art = await fetchArt(`rg:${releaseGroupId}`, `https://coverartarchive.org/release-group/${releaseGroupId}/front-500`);
    if (art) return art;
  }
  return fetchCoverArt(releaseId);
}
