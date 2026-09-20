import type { FolderNode, MediaCategory, TrackEntry, TrackTags } from '../types';
import { guessQueryFromTrack } from './autotag';
import { yearFromReleaseDate, type ReleaseCandidate, type ReleaseDetails, type ReleaseTrack } from './musicbrainz';
import type { FetchedArt } from './coverArt';

export const UNKNOWN_ALBUM_KEY = '';

export function normalizeText(value: string): string {
  const base = value.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
  const clean = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  // "(Remastered)" / "[Live]" style suffixes shouldn't split one album into two.
  return clean(base.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')) || clean(base);
}

export function albumKeyOf(track: TrackEntry): string {
  const album = normalizeText(track.tags?.album ?? '');
  if (!album) return UNKNOWN_ALBUM_KEY;
  return `${normalizeText(track.tags?.albumArtist || track.tags?.artist || '')}|${album}`;
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function trackNumber(track: TrackEntry): number {
  const n = Number.parseInt(track.tags?.track ?? '', 10);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

export function byTrackNumber(a: TrackEntry, b: TrackEntry): number {
  const diff = trackNumber(a) - trackNumber(b);
  if (diff !== 0 && !Number.isNaN(diff)) return diff;
  return (a.tags?.title || a.name).localeCompare(b.tags?.title || b.name);
}

export interface AlbumGroup {
  key: string;
  album: string;
  artist: string;
  year: string;
  tracks: TrackEntry[];
}

export function groupByAlbum(tracks: TrackEntry[]): AlbumGroup[] {
  const map = new Map<string, TrackEntry[]>();
  for (const track of tracks) {
    const key = albumKeyOf(track);
    const list = map.get(key);
    if (list) list.push(track); else map.set(key, [track]);
  }
  return [...map.entries()]
    .map(([key, list]) => ({
      key,
      album: mostCommon(list.map((t) => t.tags?.album ?? '')),
      artist: mostCommon(list.map((t) => t.tags?.albumArtist || t.tags?.artist || '')),
      year: mostCommon(list.map((t) => t.tags?.year ?? '')),
      tracks: [...list].sort(byTrackNumber),
    }))
    .sort((a, b) => {
      if (a.key === UNKNOWN_ALBUM_KEY) return 1;
      if (b.key === UNKNOWN_ALBUM_KEY) return -1;
      return a.album.localeCompare(b.album);
    });
}

const SECTION_WORDS = new Set([
  'music', 'songs', 'song', 'mp3', 'mp3s', 'audio', 'audios', 'tracks', 'downloads', 'media', 'sounds',
  'audiobook', 'audiobooks', 'books', 'my', 'sdcard',
]);

// "Loose" songs sit at the device root or directly in a catch-all folder like Music/,
// rather than inside a folder of their own. A top-level folder that holds one album's
// songs is already an album folder, so it doesn't count.
export function findLooseTracks(tracks: TrackEntry[], sectionFolders: Iterable<string> = []): TrackEntry[] {
  const explicit = new Set([...sectionFolders].map((name) => name.toLowerCase()));
  const byDir = new Map<string, TrackEntry[]>();
  for (const track of tracks) {
    if (track.kind !== 'audio' || track.dirPath.includes('/')) continue;
    const list = byDir.get(track.dirPath);
    if (list) list.push(track); else byDir.set(track.dirPath, [track]);
  }
  const loose: TrackEntry[] = [];
  for (const [dir, list] of byDir) {
    const lower = dir.toLowerCase();
    const isSection = dir === ''
      || explicit.has(lower)
      || lower.split(/[\s_-]+/).every((word) => SECTION_WORDS.has(word));
    const albums = new Set(list.map((t) => normalizeText(t.tags?.album ?? '')).filter(Boolean));
    if (isSection || albums.size >= 2) loose.push(...list);
  }
  return loose;
}

export function artistOf(track: TrackEntry): string {
  return track.tags?.artist || track.tags?.albumArtist || guessQueryFromTrack(track.name, track.tags).artist;
}

export interface ArtistCluster {
  key: string;
  artist: string;
  tracks: TrackEntry[];
}

export function clusterByArtist(tracks: TrackEntry[]): ArtistCluster[] {
  const map = new Map<string, ArtistCluster>();
  for (const track of tracks) {
    const artist = artistOf(track);
    const key = normalizeText(artist);
    const cluster = map.get(key);
    if (cluster) cluster.tracks.push(track); else map.set(key, { key, artist, tracks: [track] });
  }
  return [...map.values()].sort((a, b) => b.tracks.length - a.tracks.length);
}

function bigramCounts(text: string): Map<string, number> {
  const compact = text.replace(/ /g, '');
  const counts = new Map<string, number>();
  const grams = compact.length < 2 ? [compact] : Array.from({ length: compact.length - 1 }, (_, i) => compact.slice(i, i + 2));
  for (const gram of grams) counts.set(gram, (counts.get(gram) ?? 0) + 1);
  return counts;
}

export function similarity(a: string, b: string): number {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x))) return 0.9;
  const left = bigramCounts(x);
  const right = bigramCounts(y);
  let overlap = 0;
  for (const [gram, count] of left) overlap += Math.min(count, right.get(gram) ?? 0);
  const total = [...left.values()].reduce((s, n) => s + n, 0) + [...right.values()].reduce((s, n) => s + n, 0);
  return total === 0 ? 0 : (2 * overlap) / total;
}

export function songTitle(track: TrackEntry): string {
  return guessQueryFromTrack(track.name, track.tags).title;
}

// Pairs each song with the tracklist entry it most likely is, one-to-one, best matches first.
export function matchToTracklist(
  songs: TrackEntry[],
  tracklist: ReleaseTrack[],
  minScore = 0.72,
): Map<string, ReleaseTrack> {
  const pairs: Array<{ songId: string; index: number; score: number }> = [];
  for (const song of songs) {
    const title = songTitle(song);
    tracklist.forEach((entry, index) => {
      const score = similarity(title, entry.title);
      if (score >= minScore) pairs.push({ songId: song.id, index, score });
    });
  }
  pairs.sort((a, b) => b.score - a.score);
  const matches = new Map<string, ReleaseTrack>();
  const usedEntries = new Set<number>();
  for (const pair of pairs) {
    if (matches.has(pair.songId) || usedEntries.has(pair.index)) continue;
    matches.set(pair.songId, tracklist[pair.index]);
    usedEntries.add(pair.index);
  }
  return matches;
}

// Many editions of one album exist (regional, reissue, deluxe). Prefer official ones that
// have at least as many tracks as the songs we're placing, and drop lookalike duplicates.
export function rankReleases(candidates: ReleaseCandidate[], songCount: number, wantedAlbum: string): ReleaseCandidate[] {
  const scored = candidates
    .filter((c) => !wantedAlbum || similarity(c.title, wantedAlbum) >= 0.6)
    .map((c) => {
      const diff = c.trackCount - songCount;
      const fit = songCount === 0 ? 0 : diff < 0 ? 15 - diff : Math.min(diff, 30) * 0.3;
      return { c, rank: c.score + (c.status === 'Official' ? 10 : 0) + (c.date ? 1 : 0) - fit };
    })
    .sort((a, b) => b.rank - a.rank);
  const seen = new Set<string>();
  const result: ReleaseCandidate[] = [];
  for (const { c } of scored) {
    const key = `${normalizeText(c.title)}|${normalizeText(c.artist)}|${c.trackCount}|${yearFromReleaseDate(c.date)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}

export function sanitizeFolderName(value: string): string {
  const cleaned = value.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  return cleaned.slice(0, 80).trim() || 'New Album';
}

export function suggestFolderName(artist: string, album: string): string {
  const a = artist.trim();
  const b = album.trim();
  return sanitizeFolderName(a && b ? `${a} - ${b}` : b || a || 'New Album');
}

const SECTION_FOLDER_NAME: Record<MediaCategory, string> = { music: 'Music', audiobooks: 'Audiobooks', videos: 'Videos' };

export function sectionFolderFor(folderTree: FolderNode | null, category: MediaCategory): string {
  const wanted = SECTION_FOLDER_NAME[category];
  const existing = folderTree?.children.find((child) => child.name.toLowerCase() === wanted.toLowerCase());
  return existing ? existing.path : wanted;
}

export interface AlbumFields {
  album: string;
  artist: string;
  year: string;
}

export function fieldsFromRelease(release: ReleaseDetails): AlbumFields {
  return { album: release.title, artist: release.artist, year: yearFromReleaseDate(release.date) };
}

const BLANK_TAGS: TrackTags = {
  title: '', artist: '', album: '', albumArtist: '', track: '', year: '', genre: '', picture: null,
};

// fillOnly keeps whatever tags a song already has and only fills the blanks;
// otherwise the album's values win wherever they exist.
export function buildAlbumTags(
  song: TrackEntry,
  fields: AlbumFields,
  matched: ReleaseTrack | null,
  art: FetchedArt | null,
  fillOnly: boolean,
): TrackTags {
  const base = song.tags ?? BLANK_TAGS;
  const pick = (existing: string, incoming: string) => (fillOnly ? existing || incoming : incoming || existing);
  const artPicture = art ? { format: art.format, data: art.data } : null;
  return {
    ...base,
    title: pick(base.title, matched?.title ?? songTitle(song)),
    artist: pick(base.artist, fields.artist),
    albumArtist: pick(base.albumArtist, fields.artist),
    album: pick(base.album, fields.album),
    year: pick(base.year, fields.year),
    track: pick(base.track, matched ? String(matched.position) : ''),
    picture: fillOnly ? base.picture ?? artPicture : artPicture ?? base.picture,
  };
}
