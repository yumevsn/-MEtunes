import { throttledFetch } from './httpThrottle';

export interface MusicBrainzMatch {
  recordingId: string;
  score: number;
  title: string;
  artist: string;
  releaseId: string | null;
  releaseTitle: string | null;
  releaseDate: string | null;
}

interface MbArtistCredit {
  name: string;
}

interface MbRelease {
  id: string;
  title: string;
  date?: string;
}

interface MbRecording {
  id: string;
  score?: number;
  title: string;
  'artist-credit'?: MbArtistCredit[];
  releases?: MbRelease[];
}

function escapeLucene(value: string): string {
  return value.replace(/(["\\:()[\]{}^~*?+\-!&|])/g, '\\$1');
}

export interface RecordingQuery {
  title: string;
  artist?: string;
  album?: string;
}

export async function searchRecording(query: RecordingQuery): Promise<MusicBrainzMatch[]> {
  const clauses: string[] = [];
  if (query.title.trim()) clauses.push(`recording:"${escapeLucene(query.title.trim())}"`);
  if (query.artist?.trim()) clauses.push(`artist:"${escapeLucene(query.artist.trim())}"`);
  if (query.album?.trim()) clauses.push(`release:"${escapeLucene(query.album.trim())}"`);
  if (clauses.length === 0) return [];

  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(clauses.join(' AND '))}&fmt=json&limit=8`;
  const res = await throttledFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`MusicBrainz lookup failed (${res.status})`);
  const data = (await res.json()) as { recordings?: MbRecording[] };

  return (data.recordings ?? []).map((rec) => {
    const artist = rec['artist-credit']?.map((c) => c.name).join(', ') ?? '';
    const release = rec.releases?.[0] ?? null;
    return {
      recordingId: rec.id,
      score: rec.score ?? 0,
      title: rec.title,
      artist,
      releaseId: release?.id ?? null,
      releaseTitle: release?.title ?? null,
      releaseDate: release?.date ?? null,
    };
  });
}

export function yearFromReleaseDate(date: string | null): string {
  if (!date) return '';
  const match = /^(\d{4})/.exec(date);
  return match ? match[1] : '';
}
