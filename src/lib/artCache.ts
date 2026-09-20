import type { TrackTags } from '../types';

type Picture = NonNullable<TrackTags['picture']>;

const urlByFingerprint = new Map<string, string>();
const urlByBytes = new WeakMap<Uint8Array, string>();

// Songs from one album carry identical cover bytes in separate arrays. Sampling a
// few KB plus the length identifies them cheaply so they share one blob URL.
function fingerprint(picture: Picture): string {
  const { data } = picture;
  let hash = 2166136261;
  const step = Math.max(1, Math.floor(data.length / 4096));
  for (let i = 0; i < data.length; i += step) {
    hash = Math.imul(hash ^ data[i], 16777619);
  }
  return `${picture.format}:${data.length}:${hash >>> 0}`;
}

export function getArtUrl(picture: TrackTags['picture']): string | null {
  if (!picture) return null;
  const cached = urlByBytes.get(picture.data);
  if (cached) return cached;
  const key = fingerprint(picture);
  let url = urlByFingerprint.get(key);
  if (!url) {
    const bytes = picture.data.slice().buffer as ArrayBuffer;
    url = URL.createObjectURL(new Blob([bytes], { type: picture.format }));
    urlByFingerprint.set(key, url);
  }
  urlByBytes.set(picture.data, url);
  return url;
}
