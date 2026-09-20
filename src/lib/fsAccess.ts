import type { FolderNode, ImportItem, MediaCategory, TrackEntry } from '../types';
import { joinPath, mediaKindOf, topFolderOf } from './format';

export const IGNORED_DIR_NAMES = new Set([
  'system volume information',
  '.trashes',
  '.spotlight-v100',
  '.fseventsd',
  'found.000',
  '.metunes',
]);

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function pickDeviceRoot(): Promise<FileSystemDirectoryHandle> {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  return handle;
}

interface ScanResult {
  tracks: TrackEntry[];
  folderTree: FolderNode;
}

export async function scanDevice(
  root: FileSystemDirectoryHandle,
  categoryFor: (topFolder: string, kind: 'audio' | 'video') => MediaCategory,
  onProgress?: (count: number) => void,
): Promise<ScanResult> {
  const tracks: TrackEntry[] = [];
  let count = 0;

  async function walk(dirHandle: FileSystemDirectoryHandle, dirPath: string): Promise<FolderNode> {
    const node: FolderNode = { name: dirHandle.name, path: dirPath, handle: dirHandle, children: [] };
    const entries: Array<[string, FileSystemHandle]> = [];
    for await (const entry of dirHandle.entries()) {
      entries.push(entry);
    }
    entries.sort((a, b) => a[0].localeCompare(b[0]));

    for (const [name, handle] of entries) {
      if (handle.kind === 'directory') {
        if (IGNORED_DIR_NAMES.has(name.toLowerCase())) continue;
        const childPath = joinPath(dirPath, name);
        const childNode = await walk(handle as FileSystemDirectoryHandle, childPath);
        node.children.push(childNode);
      } else {
        const kind = mediaKindOf(name);
        if (!kind) continue;
        const filePath = joinPath(dirPath, name);
        const topFolder = topFolderOf(filePath);
        const fileHandle = handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
        tracks.push({
          id: filePath,
          name,
          dirPath,
          topFolder,
          handle: fileHandle,
          parentHandle: dirHandle,
          size: file.size,
          ext,
          kind,
          category: categoryFor(topFolder, kind),
          canWriteTags: ext === 'mp3',
          tags: null,
          tagsLoaded: false,
          durationSec: null,
        });
        count += 1;
        onProgress?.(count);
      }
    }
    return node;
  }

  const folderTree = await walk(root, '');
  return { tracks, folderTree };
}

export async function getDirectoryHandleForPath(
  root: FileSystemDirectoryHandle,
  path: string,
  create = false,
): Promise<FileSystemDirectoryHandle> {
  if (!path) return root;
  const parts = path.split('/').filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create });
  }
  return current;
}

export async function createFolder(
  root: FileSystemDirectoryHandle,
  parentPath: string,
  name: string,
): Promise<void> {
  const parent = await getDirectoryHandleForPath(root, parentPath);
  await parent.getDirectoryHandle(name, { create: true });
}

export async function deleteTrack(track: TrackEntry): Promise<void> {
  await track.parentHandle.removeEntry(track.name);
}

export async function writeFileHandle(
  handle: FileSystemFileHandle,
  data: BufferSource | Blob | string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function moveTrack(
  root: FileSystemDirectoryHandle,
  track: TrackEntry,
  destFolderPath: string,
): Promise<FileSystemFileHandle> {
  if (destFolderPath === track.dirPath) return track.handle;
  const destDir = await getDirectoryHandleForPath(root, destFolderPath, true);
  const file = await track.handle.getFile();
  const buffer = await file.arrayBuffer();
  // Never overwrite a different file that already has this name in the destination.
  const newName = await uniqueFileName(destDir, track.name);
  const newHandle = await destDir.getFileHandle(newName, { create: true });
  await writeFileHandle(newHandle, buffer);
  await track.parentHandle.removeEntry(track.name);
  return newHandle;
}

export async function renameTrack(track: TrackEntry, newName: string): Promise<FileSystemFileHandle> {
  const file = await track.handle.getFile();
  const buffer = await file.arrayBuffer();
  const newHandle = await track.parentHandle.getFileHandle(newName, { create: true });
  await writeFileHandle(newHandle, buffer);
  await track.parentHandle.removeEntry(track.name);
  return newHandle;
}

async function entryExists(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch (err) {
    const errName = (err as DOMException).name;
    if (errName === 'NotFoundError') return false;
    // A folder with this name already exists, so the name is taken.
    if (errName === 'TypeMismatchError') return true;
    throw err;
  }
}

// "Song.mp3" -> "Song (2).mp3", "Song (3).mp3", ... so imports never overwrite existing files.
async function uniqueFileName(dir: FileSystemDirectoryHandle, name: string): Promise<string> {
  if (!(await entryExists(dir, name))) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base} (${n})${ext}`;
    if (!(await entryExists(dir, candidate))) return candidate;
  }
  throw new Error(`Too many files named "${name}"`);
}

export async function importFile(
  root: FileSystemDirectoryHandle,
  destPath: string,
  item: ImportItem,
): Promise<void> {
  const segments = item.relativePath.split('/').filter(Boolean);
  const fileName = segments.pop() as string;
  const dirPath = [destPath, ...segments].filter(Boolean).join('/');
  const dir = await getDirectoryHandleForPath(root, dirPath, true);
  const finalName = await uniqueFileName(dir, fileName);
  const handle = await dir.getFileHandle(finalName, { create: true });
  await writeFileHandle(handle, item.file);
}

export function flattenFolders(node: FolderNode, acc: FolderNode[] = []): FolderNode[] {
  acc.push(node);
  for (const child of node.children) flattenFolders(child, acc);
  return acc;
}

export function findFolderNode(root: FolderNode, path: string): FolderNode | undefined {
  if (root.path === path) return root;
  for (const child of root.children) {
    const found = findFolderNode(child, path);
    if (found) return found;
  }
  return undefined;
}
