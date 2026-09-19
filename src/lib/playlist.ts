import type { TrackEntry } from '../types';

export const PLAYLIST_EXTENSION = '.m3u8';

export function buildM3U(tracks: TrackEntry[]): string {
  const lines = ['#EXTM3U'];
  for (const track of tracks) {
    const artist = track.tags?.artist || 'Unknown Artist';
    const title = track.tags?.title || track.name;
    const duration = track.durationSec != null ? Math.round(track.durationSec) : -1;
    lines.push(`#EXTINF:${duration},${artist} - ${title}`);
    lines.push(track.id);
  }
  return `${lines.join('\n')}\n`;
}

export function parseM3U(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

export function playlistNameFromFileName(fileName: string): string {
  return fileName.replace(/\.m3u8?$/i, '');
}
