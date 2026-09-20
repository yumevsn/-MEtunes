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

export interface ReleaseCandidate {
  id: string;
  releaseGroupId: string | null;
  title: string;
  artist: string;
  date: string | null;
  country: string | null;
  status: string | null;
  trackCount: number;
  score: number;
}

export interface ReleaseTrack {
  disc: number;
  position: number;
  title: string;
}

export interface ReleaseDetails {
  id: string;
  releaseGroupId: string | null;
  title: string;
  artist: string;
  date: string | null;
  tracks: ReleaseTrack[];
}

interface MbSearchRelease {
  id: string;
  score?: number;
  title: string;
  status?: string;
  date?: string;
  country?: string;
  'track-count'?: number;
  'artist-credit'?: MbArtistCredit[];
  'release-group'?: { id: string };
}

export async function searchReleases(query: { album: string; artist?: string }): Promise<ReleaseCandidate[]> {
  const clauses: string[] = [];
  if (query.album.trim()) clauses.push(`release:"${escapeLucene(query.album.trim())}"`);
  if (query.artist?.trim()) clauses.push(`artist:"${escapeLucene(query.artist.trim())}"`);
  if (clauses.length === 0) return [];
  const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(clauses.join(' AND '))}&fmt=json&limit=25`;
  const res = await throttledFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`MusicBrainz lookup failed (${res.status})`);
  const data = (await res.json()) as { releases?: MbSearchRelease[] };
  return (data.releases ?? []).map((r) => ({
    id: r.id,
    releaseGroupId: r['release-group']?.id ?? null,
    title: r.title,
    artist: r['artist-credit']?.map((c) => c.name).join(', ') ?? '',
    date: r.date ?? null,
    country: r.country ?? null,
    status: r.status ?? null,
    trackCount: r['track-count'] ?? 0,
    score: r.score ?? 0,
  }));
}

interface MbReleaseDetail {
  id: string;
  title: string;
  date?: string;
  'artist-credit'?: MbArtistCredit[];
  'release-group'?: { id: string };
  media?: Array<{ position?: number; tracks?: Array<{ position: number; title: string }> }>;
}

export async function getRelease(id: string): Promise<ReleaseDetails> {
  const url = `https://musicbrainz.org/ws/2/release/${id}?inc=recordings+artist-credits+release-groups&fmt=json`;
  const res = await throttledFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`MusicBrainz lookup failed (${res.status})`);
  const data = (await res.json()) as MbReleaseDetail;
  const tracks: ReleaseTrack[] = [];
  for (const [index, medium] of (data.media ?? []).entries()) {
    for (const track of medium.tracks ?? []) {
      tracks.push({ disc: medium.position ?? index + 1, position: track.position, title: track.title });
    }
  }
  return {
    id: data.id,
    releaseGroupId: data['release-group']?.id ?? null,
    title: data.title,
    artist: data['artist-credit']?.map((c) => c.name).join(', ') ?? '',
    date: data.date ?? null,
    tracks,
  };
}

export function yearFromReleaseDate(date: string | null): string {
  if (!date) return '';
  const match = /^(\d{4})/.exec(date);
  return match ? match[1] : '';
}
