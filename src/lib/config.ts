import type { MediaCategory } from '../types';

const CONFIG_FILE_NAME = '.metunes-library.json';

export interface DeviceConfig {
  folderCategories: Record<string, MediaCategory>;
}

const EMPTY_CONFIG: DeviceConfig = { folderCategories: {} };

export async function loadConfig(root: FileSystemDirectoryHandle): Promise<DeviceConfig> {
  try {
    const handle = await root.getFileHandle(CONFIG_FILE_NAME);
    const file = await handle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text);
    return { folderCategories: parsed.folderCategories ?? {} };
  } catch {
    return { ...EMPTY_CONFIG };
  }
}

export async function saveConfig(root: FileSystemDirectoryHandle, config: DeviceConfig): Promise<void> {
  const handle = await root.getFileHandle(CONFIG_FILE_NAME, { create: true });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(config, null, 2));
  await writable.close();
}

const AUDIOBOOK_HINTS = ['audiobook', 'audiobooks', 'book', 'books', 'talkingbook'];
const VIDEO_HINTS = ['video', 'videos', 'movie', 'movies', 'clip', 'clips'];

export function guessCategoryForFolder(topFolder: string, kind: 'audio' | 'video'): MediaCategory {
  const key = topFolder.toLowerCase();
  if (AUDIOBOOK_HINTS.some((hint) => key.includes(hint))) return 'audiobooks';
  if (VIDEO_HINTS.some((hint) => key.includes(hint))) return 'videos';
  return kind === 'video' ? 'videos' : 'music';
}
