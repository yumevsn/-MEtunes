import type { PlaylistEntry } from '../types';
import { parseM3U, playlistNameFromFileName, PLAYLIST_EXTENSION } from './playlist';

export async function loadPlaylistsFromRoot(root: FileSystemDirectoryHandle): Promise<PlaylistEntry[]> {
  const playlists: PlaylistEntry[] = [];
  for await (const [name, handle] of root.entries()) {
    if (handle.kind !== 'file') continue;
    if (!/\.m3u8?$/i.test(name)) continue;
    const fileHandle = handle as FileSystemFileHandle;
    const file = await fileHandle.getFile();
    const text = await file.text();
    playlists.push({
      name: playlistNameFromFileName(name),
      fileName: name,
      handle: fileHandle,
      trackPaths: parseM3U(text),
    });
  }
  playlists.sort((a, b) => a.name.localeCompare(b.name));
  return playlists;
}

export function sanitizePlaylistFileName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]+/g, '_');
  return cleaned.endsWith(PLAYLIST_EXTENSION) ? cleaned : `${cleaned}${PLAYLIST_EXTENSION}`;
}
