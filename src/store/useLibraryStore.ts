import { create } from 'zustand';
import type {
  AlbumApplyResult, AlbumPlanItem, DeviceIdentity, FolderNode, ImportItem, ImportResult, MediaCategory,
  PlaylistEntry, TrackEntry, TrackTags,
} from '../types';
import {
  createFolder as fsCreateFolder,
  deleteTrack as fsDeleteTrack,
  getDirectoryHandleForPath,
  importFile as fsImportFile,
  moveTrack as fsMoveTrack,
  renameTrack as fsRenameTrack,
  pickDeviceRoot,
  scanDevice,
  writeFileHandle,
} from '../lib/fsAccess';
import { guessCategoryForFolder, loadConfig, saveConfig, type DeviceConfig } from '../lib/config';
import { readTags, writeMp3Tags } from '../lib/metadata';
import { identifyUsbDevice } from '../lib/usbIdentify';
import { loadPlaylistsFromRoot, sanitizePlaylistFileName } from '../lib/playlists';
import { buildM3U } from '../lib/playlist';
import { buildDemoLibrary, type DemoSeed } from '../lib/demoData';

export type ViewSelection =
  | { type: 'category'; category: MediaCategory }
  | { type: 'playlist'; fileName: string }
  | { type: 'folder'; path: string };

export type ConnectionStatus = 'idle' | 'connecting' | 'scanning' | 'ready' | 'error';

// list and grid are two layouts of the same "Songs" view.
export type ViewMode = 'list' | 'grid' | 'albums' | 'artists';

const VIEW_MODES: ViewMode[] = ['list', 'grid', 'albums', 'artists'];

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences are a convenience; ignore storage being blocked.
  }
}

interface LibraryState {
  root: FileSystemDirectoryHandle | null;
  rootName: string;
  device: DeviceIdentity | null;
  isDemo: boolean;
  demoSeedTags: Record<string, DemoSeed> | null;
  config: DeviceConfig;
  tracksById: Record<string, TrackEntry>;
  trackOrder: string[];
  folderTree: FolderNode | null;
  playlists: PlaylistEntry[];
  status: ConnectionStatus;
  scanProgress: number;
  hasLoadedOnce: boolean;
  errorMessage: string | null;
  selectedView: ViewSelection;
  searchQuery: string;
  currentTrackId: string | null;
  isPlaying: boolean;
  visibleTrackIds: string[];
  nowPlayingOpen: boolean;
  pendingImport: ImportItem[] | null;
  viewMode: ViewMode;
  songLayout: 'list' | 'grid';
  showArt: boolean;
  sidebarOpen: boolean;

  connect: () => Promise<void>;
  connectDemo: () => Promise<void>;
  disconnect: () => void;
  identifyDevice: () => Promise<void>;
  rescan: () => Promise<void>;
  setFolderCategory: (topFolder: string, category: MediaCategory) => Promise<void>;
  updateTrackTags: (id: string, tags: TrackTags) => Promise<void>;
  createFolder: (parentPath: string, name: string) => Promise<void>;
  deleteTrack: (id: string) => Promise<void>;
  deleteTracks: (ids: string[]) => Promise<void>;
  moveTrack: (id: string, destFolderPath: string) => Promise<void>;
  moveTracks: (ids: string[], destFolderPath: string) => Promise<void>;
  renameTrack: (id: string, newBaseName: string) => Promise<void>;
  createPlaylist: (name: string, trackIds: string[]) => Promise<void>;
  addTracksToPlaylist: (fileName: string, trackIds: string[]) => Promise<void>;
  removeTrackFromPlaylist: (fileName: string, trackId: string) => Promise<void>;
  deletePlaylist: (fileName: string) => Promise<void>;
  setSelectedView: (view: ViewSelection) => void;
  setSearchQuery: (query: string) => void;
  setCurrentTrack: (id: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVisibleTrackIds: (ids: string[]) => void;
  setNowPlayingOpen: (open: boolean) => void;
  setPendingImport: (items: ImportItem[] | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setShowArt: (show: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  applyAlbumPlan: (
    folderPath: string,
    items: AlbumPlanItem[],
    opts?: {
      rescan?: boolean;
      onProgress?: (done: number, total: number, current: string) => void;
      shouldCancel?: () => boolean;
    },
  ) => Promise<AlbumApplyResult>;
  importItems: (
    items: ImportItem[],
    destPath: string,
    onProgress: (done: number, total: number, current: string) => void,
    shouldCancel: () => boolean,
  ) => Promise<ImportResult>;
}

interface ScanOutcome {
  tracksById: Record<string, TrackEntry>;
  trackOrder: string[];
  folderTree: FolderNode;
  playlists: PlaylistEntry[];
}

async function loadTagsInBackground(
  tracks: TrackEntry[],
  seedTags: Record<string, DemoSeed> | null,
  onUpdate: (id: string, patch: Partial<TrackEntry>) => void,
) {
  const concurrency = 6;
  let index = 0;
  async function worker() {
    while (index < tracks.length) {
      const current = index;
      index += 1;
      const track = tracks[current];
      const seed = seedTags?.[track.id];
      try {
        const file = await track.handle.getFile();
        const { tags, durationSec } = await readTags(file);
        if (!tags.title && seed) {
          onUpdate(track.id, { tags: seed.tags, tagsLoaded: true, durationSec: seed.durationSec });
        } else {
          // Demo files are placeholder bytes with no real audio to measure, so keep their authored length.
          onUpdate(track.id, { tags, tagsLoaded: true, durationSec: durationSec ?? seed?.durationSec ?? null });
        }
      } catch {
        if (seed) {
          onUpdate(track.id, { tags: seed.tags, tagsLoaded: true, durationSec: seed.durationSec });
        } else {
          onUpdate(track.id, { tagsLoaded: true });
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tracks.length) }, worker));
}

async function scanAndLoad(
  root: FileSystemDirectoryHandle,
  config: DeviceConfig,
  seedTags: Record<string, DemoSeed> | null,
  onProgress: (count: number) => void,
  onScanned: (outcome: ScanOutcome) => void,
  onTagUpdate: (id: string, patch: Partial<TrackEntry>) => void,
) {
  const categoryFor = (topFolder: string, kind: 'audio' | 'video'): MediaCategory =>
    config.folderCategories[topFolder] ?? guessCategoryForFolder(topFolder, kind);
  const { tracks, folderTree } = await scanDevice(root, categoryFor, onProgress);
  const playlists = await loadPlaylistsFromRoot(root);
  const tracksById: Record<string, TrackEntry> = {};
  const trackOrder: string[] = [];
  for (const track of tracks) {
    tracksById[track.id] = track;
    trackOrder.push(track.id);
  }
  onScanned({ tracksById, trackOrder, folderTree, playlists });
  loadTagsInBackground(tracks, seedTags, onTagUpdate);
}

export const useLibraryStore = create<LibraryState>((set, get) => {
  const applyTagPatch = (id: string, patch: Partial<TrackEntry>) =>
    set((state) => {
      const existing = state.tracksById[id];
      if (!existing) return state;
      return { tracksById: { ...state.tracksById, [id]: { ...existing, ...patch } } };
    });

  return {
    root: null,
    rootName: '',
    device: null,
    isDemo: false,
    demoSeedTags: null,
    config: { folderCategories: {} },
    tracksById: {},
    trackOrder: [],
    folderTree: null,
    playlists: [],
    status: 'idle',
    scanProgress: 0,
    hasLoadedOnce: false,
    errorMessage: null,
    selectedView: { type: 'category', category: 'music' },
    searchQuery: '',
    currentTrackId: null,
    isPlaying: false,
    visibleTrackIds: [],
    nowPlayingOpen: false,
    pendingImport: null,
    viewMode: VIEW_MODES.find((mode) => mode === readPref('metunes.viewMode')) ?? 'list',
    songLayout: readPref('metunes.songLayout') === 'grid' ? 'grid' : 'list',
    showArt: readPref('metunes.showArt') !== 'false',
    sidebarOpen: false,

    connect: async () => {
      set({ status: 'connecting', errorMessage: null });
      let root: FileSystemDirectoryHandle;
      try {
        root = await pickDeviceRoot();
      } catch {
        set({ status: 'idle' });
        return;
      }
      set({ status: 'scanning', root, rootName: root.name, scanProgress: 0, isDemo: false, demoSeedTags: null, device: null });
      try {
        const config = await loadConfig(root);
        await scanAndLoad(
          root,
          config,
          null,
          (count) => set({ scanProgress: count }),
          (outcome) => set({ config, ...outcome, status: 'ready', hasLoadedOnce: true }),
          applyTagPatch,
        );
      } catch (err) {
        set({ status: 'error', errorMessage: err instanceof Error ? err.message : 'Failed to read device.' });
      }
    },

    connectDemo: async () => {
      set({ status: 'connecting', errorMessage: null });
      const { root, seedTags } = await buildDemoLibrary();
      set({
        status: 'scanning',
        root,
        rootName: 'Demo Phone',
        scanProgress: 0,
        isDemo: true,
        demoSeedTags: seedTags,
        device: null,
      });
      try {
        const config = await loadConfig(root);
        await scanAndLoad(
          root,
          config,
          seedTags,
          (count) => set({ scanProgress: count }),
          (outcome) => set({ config, ...outcome, status: 'ready', hasLoadedOnce: true }),
          applyTagPatch,
        );
      } catch (err) {
        set({ status: 'error', errorMessage: err instanceof Error ? err.message : 'Failed to build the demo library.' });
      }
    },

    disconnect: () => {
      set({
        root: null,
        rootName: '',
        device: null,
        isDemo: false,
        demoSeedTags: null,
        config: { folderCategories: {} },
        tracksById: {},
        trackOrder: [],
        folderTree: null,
        playlists: [],
        status: 'idle',
        scanProgress: 0,
        hasLoadedOnce: false,
        errorMessage: null,
        currentTrackId: null,
        isPlaying: false,
        pendingImport: null,
      });
    },

    identifyDevice: async () => {
      const identity = await identifyUsbDevice();
      if (identity) set({ device: identity });
    },

    rescan: async () => {
      const { root, config, isDemo, demoSeedTags } = get();
      if (!root) return;
      set({ status: 'scanning', scanProgress: 0 });
      try {
        await scanAndLoad(
          root,
          config,
          isDemo ? demoSeedTags : null,
          (count) => set({ scanProgress: count }),
          (outcome) => set({ ...outcome, status: 'ready' }),
          applyTagPatch,
        );
      } catch (err) {
        set({ status: 'error', errorMessage: err instanceof Error ? err.message : 'Failed to rescan device.' });
      }
    },

    setFolderCategory: async (topFolder, category) => {
      const { root, config } = get();
      if (!root) return;
      const nextConfig: DeviceConfig = {
        folderCategories: { ...config.folderCategories, [topFolder]: category },
      };
      set({ config: nextConfig });
      await saveConfig(root, nextConfig);
      set((state) => {
        const tracksById = { ...state.tracksById };
        for (const id of state.trackOrder) {
          const track = tracksById[id];
          if (track.topFolder === topFolder) {
            tracksById[id] = { ...track, category };
          }
        }
        return { tracksById };
      });
    },

    updateTrackTags: async (id, tags) => {
      const track = get().tracksById[id];
      if (!track) return;
      if (track.canWriteTags) {
        const file = await track.handle.getFile();
        const blob = await writeMp3Tags(file, tags);
        await writeFileHandle(track.handle, blob);
      }
      set((state) => ({
        tracksById: { ...state.tracksById, [id]: { ...track, tags } },
      }));
    },

    createFolder: async (parentPath, name) => {
      const { root } = get();
      if (!root || !name.trim()) return;
      await fsCreateFolder(root, parentPath, name.trim());
      await get().rescan();
    },

    deleteTrack: async (id) => {
      await get().deleteTracks([id]);
    },

    deleteTracks: async (ids) => {
      const { tracksById } = get();
      for (const id of ids) {
        const track = tracksById[id];
        if (track) await fsDeleteTrack(track);
      }
      const idSet = new Set(ids);
      set((state) => {
        const nextTracksById = { ...state.tracksById };
        for (const id of ids) delete nextTracksById[id];
        return {
          tracksById: nextTracksById,
          trackOrder: state.trackOrder.filter((t) => !idSet.has(t)),
          currentTrackId: state.currentTrackId && idSet.has(state.currentTrackId) ? null : state.currentTrackId,
        };
      });
    },

    moveTrack: async (id, destFolderPath) => {
      await get().moveTracks([id], destFolderPath);
    },

    moveTracks: async (ids, destFolderPath) => {
      const { root, tracksById } = get();
      if (!root) return;
      for (const id of ids) {
        const track = tracksById[id];
        if (track) await fsMoveTrack(root, track, destFolderPath);
      }
      await get().rescan();
    },

    renameTrack: async (id, newBaseName) => {
      const track = get().tracksById[id];
      if (!track || !newBaseName.trim()) return;
      const ext = track.name.slice(track.name.lastIndexOf('.'));
      const newName = newBaseName.trim().endsWith(ext) ? newBaseName.trim() : `${newBaseName.trim()}${ext}`;
      await fsRenameTrack(track, newName);
      await get().rescan();
    },

    createPlaylist: async (name, trackIds) => {
      const { root, tracksById } = get();
      if (!root || !name.trim()) return;
      const fileName = sanitizePlaylistFileName(name);
      const tracks = trackIds.map((id) => tracksById[id]).filter(Boolean);
      const handle = await root.getFileHandle(fileName, { create: true });
      await writeFileHandle(handle, buildM3U(tracks));
      const playlists = await loadPlaylistsFromRoot(root);
      set({ playlists });
    },

    addTracksToPlaylist: async (fileName, trackIds) => {
      const { root, playlists, tracksById } = get();
      if (!root) return;
      const playlist = playlists.find((p) => p.fileName === fileName);
      if (!playlist) return;
      const merged = [...playlist.trackPaths];
      for (const id of trackIds) {
        if (!merged.includes(id)) merged.push(id);
      }
      const tracks = merged.map((id) => tracksById[id]).filter(Boolean) as TrackEntry[];
      await writeFileHandle(playlist.handle, buildM3U(tracks));
      const updatedPlaylists = await loadPlaylistsFromRoot(root);
      set({ playlists: updatedPlaylists });
    },

    removeTrackFromPlaylist: async (fileName, trackId) => {
      const { root, playlists, tracksById } = get();
      if (!root) return;
      const playlist = playlists.find((p) => p.fileName === fileName);
      if (!playlist) return;
      const remaining = playlist.trackPaths.filter((path) => path !== trackId);
      const tracks = remaining.map((id) => tracksById[id]).filter(Boolean) as TrackEntry[];
      await writeFileHandle(playlist.handle, buildM3U(tracks));
      const updatedPlaylists = await loadPlaylistsFromRoot(root);
      set({ playlists: updatedPlaylists });
    },

    deletePlaylist: async (fileName) => {
      const { root } = get();
      if (!root) return;
      await root.removeEntry(fileName);
      const playlists = await loadPlaylistsFromRoot(root);
      set((state) => ({
        playlists,
        selectedView:
          state.selectedView.type === 'playlist' && state.selectedView.fileName === fileName
            ? { type: 'category', category: 'music' }
            : state.selectedView,
      }));
    },

    // Search results replace the current view, so navigating anywhere else ends the search.
    // On phones the sidebar is a drawer, so picking something also closes it.
    setSelectedView: (view) => set({ selectedView: view, searchQuery: '', sidebarOpen: false }),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setCurrentTrack: (id) => set({ currentTrackId: id, isPlaying: id != null }),
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    setVisibleTrackIds: (ids) => set({ visibleTrackIds: ids }),
    setNowPlayingOpen: (open) => set({ nowPlayingOpen: open }),
    setPendingImport: (items) => set({ pendingImport: items }),

    setViewMode: (mode) => {
      writePref('metunes.viewMode', mode);
      if (mode === 'list' || mode === 'grid') {
        // Remembered so going Albums -> Songs returns to the layout you last used.
        writePref('metunes.songLayout', mode);
        set({ viewMode: mode, songLayout: mode });
      } else {
        set({ viewMode: mode });
      }
    },

    setShowArt: (show) => {
      writePref('metunes.showArt', String(show));
      set({ showArt: show });
    },

    // Writes album info into each song's tags first, then (optionally) moves it into the
    // album folder, so the tags travel with the copied file.
    applyAlbumPlan: async (folderPath, items, opts = {}) => {
      const { root } = get();
      const result: AlbumApplyResult = { applied: 0, failed: [], cancelled: false };
      if (!root) return result;
      try {
        if (folderPath) await getDirectoryHandleForPath(root, folderPath, true);
      } catch (err) {
        result.failed.push({ name: folderPath, reason: err instanceof Error ? err.message : 'Could not create the folder' });
        return result;
      }
      for (const [index, item] of items.entries()) {
        if (opts.shouldCancel?.()) {
          result.cancelled = true;
          break;
        }
        const track = get().tracksById[item.id];
        if (!track) continue;
        opts.onProgress?.(index, items.length, track.name);
        try {
          if (item.tags && track.canWriteTags) await get().updateTrackTags(item.id, item.tags);
          if (item.move) await fsMoveTrack(root, get().tracksById[item.id], folderPath);
          result.applied += 1;
        } catch (err) {
          result.failed.push({ name: track.name, reason: err instanceof Error && err.message ? err.message : 'Could not update this file' });
        }
      }
      opts.onProgress?.(items.length, items.length, '');
      // An empty plan still created a folder, which the tree needs a rescan to show.
      if (opts.rescan !== false && (result.applied > 0 || items.length === 0)) await get().rescan();
      return result;
    },

    importItems: async (items, destPath, onProgress, shouldCancel) => {
      const { root } = get();
      const result: ImportResult = { imported: 0, failed: [], cancelled: false };
      if (!root) return result;
      for (const [index, item] of items.entries()) {
        if (shouldCancel()) {
          result.cancelled = true;
          break;
        }
        onProgress(index, items.length, item.file.name);
        try {
          await fsImportFile(root, destPath, item);
          result.imported += 1;
        } catch (err) {
          result.failed.push({
            name: item.relativePath,
            reason: err instanceof Error && err.message ? err.message : 'Could not write to the device',
          });
        }
      }
      onProgress(items.length, items.length, '');
      if (result.imported > 0) await get().rescan();
      return result;
    },
  };
});
