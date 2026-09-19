import type { TrackTags } from '../types';
import type { MusicBrainzMatch } from './musicbrainz';
import { yearFromReleaseDate } from './musicbrainz';
import type { FetchedArt } from './coverArt';

export const AUTO_ACCEPT_SCORE = 90;

export function guessQueryFromTrack(fileName: string, existing: TrackTags | null): { title: string; artist: string } {
  if (existing?.title) return { title: existing.title, artist: existing.artist };
  const base = fileName.slice(0, fileName.lastIndexOf('.')) || fileName;
  const cleaned = base.replace(/^\s*\d+[\s._-]+/, '').replace(/_/g, ' ').trim();
  const parts = cleaned.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { title: cleaned, artist: existing?.artist ?? '' };
}

export function mergeMatchIntoTags(
  base: TrackTags,
  match: MusicBrainzMatch,
  art: FetchedArt | null,
): TrackTags {
  return {
    ...base,
    title: match.title || base.title,
    artist: match.artist || base.artist,
    album: match.releaseTitle || base.album,
    year: yearFromReleaseDate(match.releaseDate) || base.year,
    picture: art ? { format: art.format, data: art.data } : base.picture,
  };
}
