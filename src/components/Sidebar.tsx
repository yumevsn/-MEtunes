import { useMemo, useState } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import type { MediaCategory } from '../types';
import { CATEGORY_LABELS } from '../types';
import { guessCategoryForFolder } from '../lib/config';
import { InputModal } from './InputModal';
import { FolderTree } from './FolderTree';
import { BookIcon, EjectIcon, FilmIcon, MusicNoteIcon, PlaylistIcon, PlusIcon, UsbIcon, XIcon } from './icons';
import type { ComponentType } from 'react';

const CATEGORIES: MediaCategory[] = ['music', 'audiobooks', 'videos'];
const CATEGORY_ICONS: Record<MediaCategory, ComponentType<{ size?: number }>> = {
  music: MusicNoteIcon, audiobooks: BookIcon, videos: FilmIcon,
};

export function Sidebar() {
  const rootName = useLibraryStore((s) => s.rootName);
  const device = useLibraryStore((s) => s.device);
  const isDemo = useLibraryStore((s) => s.isDemo);
  const tracksById = useLibraryStore((s) => s.tracksById);
  const trackOrder = useLibraryStore((s) => s.trackOrder);
  const playlists = useLibraryStore((s) => s.playlists);
  const selectedView = useLibraryStore((s) => s.selectedView);
  const setSelectedView = useLibraryStore((s) => s.setSelectedView);
  const identifyDevice = useLibraryStore((s) => s.identifyDevice);
  const disconnect = useLibraryStore((s) => s.disconnect);
  const rescan = useLibraryStore((s) => s.rescan);
  const status = useLibraryStore((s) => s.status);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);
  const setFolderCategory = useLibraryStore((s) => s.setFolderCategory);
  const folderTree = useLibraryStore((s) => s.folderTree);
  const config = useLibraryStore((s) => s.config);

  const [showNewPlaylist, setShowNewPlaylist] = useState(false);

  const counts = useMemo(() => {
    const result: Record<MediaCategory, number> = { music: 0, audiobooks: 0, videos: 0 };
    for (const id of trackOrder) {
      result[tracksById[id].category] += 1;
    }
    return result;
  }, [tracksById, trackOrder]);

  const categoryFor = (topFolder: string): MediaCategory =>
    config.folderCategories[topFolder] ?? guessCategoryForFolder(topFolder, 'audio');

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <div className="sidebar-heading">Library</div>
          {CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category];
            return (
              <button
                key={category}
                type="button"
                className={`sidebar-item ${selectedView.type === 'category' && selectedView.category === category ? 'active' : ''}`}
                onClick={() => setSelectedView({ type: 'category', category })}
              >
                <span className="sidebar-icon"><Icon size={15} /></span>
                <span className="sidebar-label">{CATEGORY_LABELS[category]}</span>
                <span className="sidebar-count">{counts[category]}</span>
              </button>
            );
          })}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-heading-row">
            <div className="sidebar-heading">Playlists</div>
            <button type="button" className="sidebar-add" onClick={() => setShowNewPlaylist(true)} title="New playlist">
              <PlusIcon size={13} />
            </button>
          </div>
          {playlists.length === 0 && <div className="sidebar-empty">No playlists yet</div>}
          {playlists.map((playlist) => (
            <div
              key={playlist.fileName}
              className={`sidebar-item sidebar-item-row ${selectedView.type === 'playlist' && selectedView.fileName === playlist.fileName ? 'active' : ''}`}
            >
              <button
                type="button"
                className="sidebar-item-main"
                onClick={() => setSelectedView({ type: 'playlist', fileName: playlist.fileName })}
              >
                <span className="sidebar-icon"><PlaylistIcon size={15} /></span>
                <span className="sidebar-label">{playlist.name}</span>
                <span className="sidebar-count">{playlist.trackPaths.length}</span>
              </button>
              <button
                type="button"
                className="sidebar-item-delete"
                title="Delete playlist"
                onClick={() => {
                  if (confirm(`Delete playlist "${playlist.name}"? The tracks themselves won't be deleted.`)) {
                    deletePlaylist(playlist.fileName);
                  }
                }}
              >
                <XIcon size={12} />
              </button>
            </div>
          ))}
        </div>

        {folderTree && (
          <div className="sidebar-section">
            <div className="sidebar-heading">Browse Folders</div>
            <FolderTree
              node={folderTree}
              depth={0}
              categoryFor={categoryFor}
              onSetCategory={setFolderCategory}
            />
          </div>
        )}
      </div>

      <div className="sidebar-device">
        {isDemo && <div className="demo-badge">🧪 Demo Mode</div>}
        <div className="device-name">
          <UsbIcon size={14} className="device-name-icon" />
          {device ? device.productName : rootName}
        </div>
        {device && <div className="device-sub">{device.manufacturerName}</div>}
        {!device && !isDemo && (
          <button type="button" className="btn btn-small" onClick={() => identifyDevice()}>
            Identify device
          </button>
        )}
        {isDemo && <div className="device-sub">Simulated — no real hardware</div>}
        <div className="device-actions">
          <button type="button" className="btn btn-small" onClick={() => rescan()} disabled={status === 'scanning'}>
            {status === 'scanning' ? 'Scanning…' : 'Rescan'}
          </button>
          <button type="button" className="btn btn-small" onClick={() => disconnect()}>
            <EjectIcon size={13} /> Eject
          </button>
        </div>
      </div>

      {showNewPlaylist && (
        <InputModal
          title="New playlist"
          label="Playlist name"
          confirmLabel="Create"
          onConfirm={(name) => createPlaylist(name, [])}
          onClose={() => setShowNewPlaylist(false)}
        />
      )}
    </aside>
  );
}
