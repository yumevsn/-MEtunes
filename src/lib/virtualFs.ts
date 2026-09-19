// A tiny in-memory stand-in for the File System Access API, used only by
// Demo Mode so people without a phone/reader can try MEtunes. It implements
// just the subset of FileSystemDirectoryHandle / FileSystemFileHandle that
// the rest of the app actually calls (see lib/fsAccess.ts), so every other
// feature — browsing, tagging, playlists, move/rename/delete — runs through
// its real code path against this fake storage instead of a special case.

type VirtualEntry = VirtualFileHandle | VirtualDirectoryHandle;

export class VirtualFileHandle {
  readonly kind = 'file' as const;
  name: string;
  private file: File;

  constructor(name: string, file: File) {
    this.name = name;
    this.file = file;
  }

  async getFile(): Promise<File> {
    return this.file;
  }

  async createWritable(): Promise<{ write(data: BufferSource | Blob | string): Promise<void>; close(): Promise<void> }> {
    const chunks: BlobPart[] = [];
    const originalType = this.file.type;
    const name = this.name;
    const applyFile = (file: File) => { this.file = file; };
    return {
      async write(data: BufferSource | Blob | string) {
        chunks.push(data instanceof Blob ? data : (data as BlobPart));
      },
      async close() {
        const blob = new Blob(chunks, { type: originalType });
        applyFile(new File([blob], name, { type: originalType }));
      },
    };
  }
}

export class VirtualDirectoryHandle {
  readonly kind = 'directory' as const;
  name: string;
  private children = new Map<string, VirtualEntry>();

  constructor(name: string) {
    this.name = name;
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<VirtualDirectoryHandle> {
    const existing = this.children.get(name);
    if (existing) {
      if (existing.kind !== 'directory') throw new DOMException(`${name} is not a directory`, 'TypeMismatchError');
      return existing;
    }
    if (!options?.create) throw new DOMException(`${name} not found`, 'NotFoundError');
    const dir = new VirtualDirectoryHandle(name);
    this.children.set(name, dir);
    return dir;
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<VirtualFileHandle> {
    const existing = this.children.get(name);
    if (existing) {
      if (existing.kind !== 'file') throw new DOMException(`${name} is not a file`, 'TypeMismatchError');
      return existing;
    }
    if (!options?.create) throw new DOMException(`${name} not found`, 'NotFoundError');
    const file = new VirtualFileHandle(name, new File([], name));
    this.children.set(name, file);
    return file;
  }

  async removeEntry(name: string): Promise<void> {
    this.children.delete(name);
  }

  async *entries(): AsyncGenerator<[string, VirtualEntry]> {
    for (const entry of this.children.entries()) {
      yield entry;
    }
  }
}
