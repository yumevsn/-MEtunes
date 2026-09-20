export type MediaCategory = 'music' | 'audiobooks' | 'videos';

export const CATEGORY_LABELS: Record<MediaCategory, string> = {
  music: 'Music',
  audiobooks: 'Audiobooks',
  videos: 'Videos',
};

export interface TrackTags {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  track: string;
  year: string;
  genre: string;
  picture: { format: string; data: Uint8Array } | null;
}

export interface TrackEntry {
  id: string; // relative path from device root, forward-slash separated
  name: string; // file name including extension
  dirPath: string; // relative path of parent folder ('' for root)
  topFolder: string; // first path segment, '' if at root
  handle: FileSystemFileHandle;
  parentHandle: FileSystemDirectoryHandle;
  size: number;
  ext: string;
  kind: 'audio' | 'video';
  category: MediaCategory;
  canWriteTags: boolean; // only mp3 supported for writing in MVP
  tags: TrackTags | null;
  tagsLoaded: boolean;
  durationSec: number | null;
}

export interface FolderNode {
  name: string;
  path: string;
  handle: FileSystemDirectoryHandle;
  children: FolderNode[];
}

export interface PlaylistEntry {
  name: string; // without extension
  fileName: string; // with .m3u8 extension
  handle: FileSystemFileHandle;
  trackPaths: string[]; // relative paths as stored in the playlist file
}

export interface ImportItem {
  file: File;
  relativePath: string; // '/'-separated, ends with the file name; may include folders from a dropped/picked folder
}

export interface ImportResult {
  imported: number;
  failed: Array<{ name: string; reason: string }>;
  cancelled: boolean;
}

export interface AlbumPlanItem {
  id: string;
  tags: TrackTags | null; // null leaves the file's tags untouched
  move: boolean;
}

export interface AlbumApplyResult {
  applied: number;
  failed: Array<{ name: string; reason: string }>;
  cancelled: boolean;
}

export interface DeviceIdentity {
  manufacturerName: string;
  productName: string;
  vendorId: number;
  productId: number;
  serialNumber?: string;
}
