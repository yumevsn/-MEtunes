import type { ImportItem } from '../types';
import { AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, mediaKindOf } from './format';

export const IMPORT_ACCEPT = [
  'audio/*',
  'video/*',
  ...[...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS].map((ext) => `.${ext}`),
].join(',');

export function isImportable(item: ImportItem): boolean {
  return mediaKindOf(item.file.name) !== null;
}

export function itemsFromFileList(files: FileList | File[]): ImportItem[] {
  return Array.from(files).map((file) => ({
    file,
    // Set by <input webkitdirectory>; keeps the picked folder's structure.
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
}

function readFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function readAllEntries(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = dir.createReader();
  const all: FileSystemEntry[] = [];
  // readEntries returns results in batches (100 in Chrome) until it yields an empty array.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

async function walkEntry(entry: FileSystemEntry, prefix: string): Promise<ImportItem[]> {
  if (entry.isFile) {
    const file = await readFile(entry as FileSystemFileEntry);
    return [{ file, relativePath: `${prefix}${entry.name}` }];
  }
  if (entry.isDirectory) {
    const children = await readAllEntries(entry as FileSystemDirectoryEntry);
    const nested = await Promise.all(children.map((child) => walkEntry(child, `${prefix}${entry.name}/`)));
    return nested.flat();
  }
  return [];
}

// DataTransferItems are only readable during the drop event, so every item is
// touched synchronously here before any await.
export function collectDroppedItems(dataTransfer: DataTransfer): Promise<ImportItem[]> {
  const jobs: Array<Promise<ImportItem[]>> = [];
  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.() ?? null;
    const file = item.getAsFile();
    if (entry) {
      jobs.push(walkEntry(entry, ''));
    } else if (file) {
      jobs.push(Promise.resolve([{ file, relativePath: file.name }]));
    }
  }
  return Promise.all(jobs).then((groups) => groups.flat());
}
