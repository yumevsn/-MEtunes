import { useEffect, useMemo, useState } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import type { TrackEntry } from '../types';
import { CATEGORY_LABELS } from '../types';
import { formatBytes, formatDuration } from '../lib/format';
import { findFolderNode } from '../lib/fsAccess';
import { NewFolderModal } from './NewFolderModal';
import { FolderPickerModal } from './FolderPickerModal';
import { PlaylistPickerModal } from './PlaylistPickerModal';
import { InputModal } from './InputModal';
import { TagEditorModal } from './TagEditorModal';
import { AutoTagModal } from './AutoTagModal';
import { ChevronDownIcon, ChevronUpIcon, FolderIcon, PauseIcon, PlayIcon, SearchIcon } from './icons';

type SortKey = 'title' | 'artist' | 'album' | 'duration' | 'format' | 'size';

export function LibraryView() {
  const selectedView = useLibraryStore((s) => s.selectedView);
  const tracksById = useLibraryStore((s) => s.tracksById);
  const trackOrder = useLibraryStore((s) => s.trackOrder);
  const playlists = useLibraryStore((s) => s.playlists);
  const folderTree = useLibraryStore((s) => s.folderTree);
  const searchQuery = useLibraryStore((s) => s.searchQuery);
  const setSearchQuery = useLibraryStore((s) => s.setSearchQuery);
  const setSelectedView = useLibraryStore((s) => s.setSelectedView);
  const currentTrackId = useLibraryStore((s) => s.currentTrackId);
  const isPlaying = useLibraryStore((s) => s.isPlaying);
  const setCurrentTrack = useLibraryStore((s) => s.setCurrentTrack);
  const setIsPlaying = useLibraryStore((s) => s.setIsPlaying);
  const setVisibleTrackIds = useLibraryStore((s) => s.setVisibleTrackIds);
  const createFolder = useLibraryStore((s) => s.createFolder);
  const moveTracks = useLibraryStore((s) => s.moveTracks);
  const deleteTracks = useLibraryStore((s) => s.deleteTracks);
  const renameTrack = useLibraryStore((s) => s.renameTrack);
  const updateTrackTags = useLibraryStore((s) => s.updateTrackTags);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const addTracksToPlaylist = useLibraryStore((s) => s.addTracksToPlaylist);
  const removeTrackFromPlaylist = useLibraryStore((s) => s.removeTrackFromPlaylist);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'title', dir: 1 });
  const [modal, setModal] = useState<null | 'newFolder' | 'move' | 'playlist' | 'rename' | 'tags' | 'autotag'>(null);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedView]);

  const currentPlaylist = selectedView.type === 'playlist'
    ? playlists.find((p) => p.fileName === selectedView.fileName) ?? null
    : null;

  const currentFolderNode = selectedView.type === 'folder' && folderTree
    ? findFolderNode(folderTree, selectedView.path) ?? null
    : null;

  const baseTracks: TrackEntry[] = useMemo(() => {
    if (selectedView.type === 'category') {
      return trackOrder.map((id) => tracksById[id]).filter((t) => t.category === selectedView.category);
    }
    if (selectedView.type === 'folder') {
      return trackOrder.map((id) => tracksById[id]).filter((t) => t.dirPath === selectedView.path);
    }
    if (currentPlaylist) {
      return currentPlaylist.trackPaths.map((path) => tracksById[path]).filter((t): t is TrackEntry => Boolean(t));
    }
    return [];
  }, [selectedView, currentPlaylist, tracksById, trackOrder]);

  const tracks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = baseTracks;
    if (query) {
      list = list.filter((t) =>
        (t.tags?.title || t.name).toLowerCase().includes(query) ||
        (t.tags?.artist || '').toLowerCase().includes(query) ||
        (t.tags?.album || '').toLowerCase().includes(query),
      );
    }
    const sorted = [...list].sort((a, b) => {
      const dir = sort.dir;
      switch (sort.key) {
        case 'artist': return dir * (a.tags?.artist || '').localeCompare(b.tags?.artist || '');
        case 'album': return dir * (a.tags?.album || '').localeCompare(b.tags?.album || '');
        case 'duration': return dir * ((a.durationSec ?? 0) - (b.durationSec ?? 0));
        case 'format': return dir * a.ext.localeCompare(b.ext);
        case 'size': return dir * (a.size - b.size);
        default: return dir * (a.tags?.title || a.name).localeCompare(b.tags?.title || b.name);
      }
    });
    return sorted;
  }, [baseTracks, searchQuery, sort]);

  useEffect(() => {
    setVisibleTrackIds(tracks.map((t) => t.id));
  }, [tracks, setVisibleTrackIds]);

  const heading = selectedView.type === 'category'
    ? CATEGORY_LABELS[selectedView.category]
    : selectedView.type === 'playlist'
      ? (currentPlaylist?.name ?? 'Playlist')
      : '';
  const breadcrumb = selectedView.type === 'folder'
    ? ['Device root', ...(selectedView.path ? selectedView.path.split('/') : [])]
    : null;
  const selectedList = Array.from(selectedIds);
  const singleTrack = selectedList.length === 1 ? tracksById[selectedList[0]] : null;
  const selectedTracks = selectedList.map((id) => tracksById[id]).filter(Boolean);
  const taggableSelected = selectedTracks.filter((t) => t.canWriteTags);

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(tracks.map((t) => t.id)) : new Set());
  }

  function playTrack(id: string) {
    setCurrentTrack(id);
    setIsPlaying(true);
  }

  function sortBy(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  function goToBreadcrumb(index: number) {
    if (!breadcrumb) return;
    const path = breadcrumb.slice(1, index + 1).join('/');
    setSelectedView({ type: 'folder', path });
  }

  return (
    <section className="library-view">
      <header className="library-header">
        {breadcrumb ? (
          <div className="breadcrumb">
            {breadcrumb.map((segment, index) => (
              <span key={index}>
                {index > 0 && <span className="breadcrumb-sep">/</span>}
                <button
                  type="button"
                  className="breadcrumb-item"
                  disabled={index === breadcrumb.length - 1}
                  onClick={() => goToBreadcrumb(index)}
                >
                  {segment}
                </button>
              </span>
            ))}
          </div>
        ) : (
          <h1>{heading}</h1>
        )}
        <div className="search-field">
          <SearchIcon size={14} className="search-field-icon" />
          <input
            className="search-input"
            placeholder="Search title, artist, album…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="library-toolbar">
        <button type="button" className="btn btn-small" onClick={() => setModal('newFolder')}>New Folder</button>
        <button type="button" className="btn btn-small" disabled={selectedIds.size === 0} onClick={() => setModal('playlist')}>
          Add to Playlist
        </button>
        <button type="button" className="btn btn-small" disabled={selectedIds.size === 0 || !folderTree} onClick={() => setModal('move')}>
          Move
        </button>
        <button type="button" className="btn btn-small" disabled={!singleTrack} onClick={() => setModal('rename')}>
          Rename
        </button>
        <button type="button" className="btn btn-small" disabled={!singleTrack} onClick={() => setModal('tags')}>
          Edit Tags
        </button>
        <button
          type="button"
          className="btn btn-small"
          disabled={taggableSelected.length === 0}
          onClick={() => setModal('autotag')}
          title="Look up title, artist, album and cover art on MusicBrainz"
        >
          Auto-Tag
        </button>
        {selectedView.type === 'playlist' && (
          <button
            type="button"
            className="btn btn-small"
            disabled={selectedIds.size === 0}
            onClick={() => {
              if (!currentPlaylist) return;
              for (const id of selectedList) removeTrackFromPlaylist(currentPlaylist.fileName, id);
              setSelectedIds(new Set());
            }}
          >
            Remove from Playlist
          </button>
        )}
        <button
          type="button"
          className="btn btn-small btn-danger"
          disabled={selectedIds.size === 0}
          onClick={() => {
            if (confirm(`Delete ${selectedIds.size} file(s) from the device? This cannot be undone.`)) {
              deleteTracks(selectedList);
              setSelectedIds(new Set());
            }
          }}
        >
          Delete
        </button>
      </div>

      <div className="track-table-wrap">
        <table className="track-table">
          <thead>
            <tr>
              <th className="col-check">
                <input
                  type="checkbox"
                  checked={tracks.length > 0 && selectedIds.size === tracks.length}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
              </th>
              <th></th>
              {(['title', 'artist', 'album', 'duration', 'format', 'size'] as const).map((key) => (
                <th key={key} onClick={() => sortBy(key)} className="sortable">
                  <span className="th-label">
                    {{ title: 'Title', artist: 'Artist', album: 'Album', duration: 'Time', format: 'Format', size: 'Size' }[key]}
                    {sort.key === key && (sort.dir === 1 ? <ChevronUpIcon size={11} /> : <ChevronDownIcon size={11} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentFolderNode?.children.map((child) => (
              <tr
                key={`folder-${child.path}`}
                className="row-folder"
                onClick={() => setSelectedView({ type: 'folder', path: child.path })}
              >
                <td className="col-check"></td>
                <td className="col-play"></td>
                <td colSpan={5}>
                  <span className="folder-cell"><FolderIcon size={15} /> {child.name}</span>
                </td>
              </tr>
            ))}
            {tracks.map((track) => (
              <tr
                key={track.id}
                className={currentTrackId === track.id ? 'row-current' : ''}
                onDoubleClick={() => playTrack(track.id)}
              >
                <td className="col-check">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(track.id)}
                    onChange={(e) => toggleSelect(track.id, e.target.checked)}
                  />
                </td>
                <td className="col-play">
                  <button type="button" className="play-btn" onClick={() => playTrack(track.id)} title="Play">
                    {currentTrackId === track.id && isPlaying ? <PauseIcon size={11} /> : <PlayIcon size={11} />}
                  </button>
                </td>
                <td>{track.tags?.title || track.name}</td>
                <td>{track.tags?.artist || (track.tagsLoaded ? '—' : '…')}</td>
                <td>{track.tags?.album || (track.tagsLoaded ? '—' : '…')}</td>
                <td>{formatDuration(track.durationSec)}</td>
                <td className="col-format">{track.ext.toUpperCase()}</td>
                <td className="col-size">{formatBytes(track.size)}</td>
              </tr>
            ))}
            {tracks.length === 0 && !currentFolderNode?.children.length && (
              <tr>
                <td colSpan={8} className="empty-row">
                  {selectedView.type === 'playlist'
                    ? 'This playlist is empty. Add tracks from a library view.'
                    : selectedView.type === 'folder'
                      ? 'This folder is empty.'
                      : 'No files in this section yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal === 'newFolder' && folderTree && (
        <NewFolderModal
          folderTree={folderTree}
          defaultParentPath={selectedView.type === 'folder' ? selectedView.path : ''}
          onCreate={createFolder}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'move' && folderTree && (
        <FolderPickerModal
          folderTree={folderTree}
          onPick={(path) => moveTracks(selectedList, path)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'playlist' && (
        <PlaylistPickerModal
          playlists={playlists}
          onPick={(fileName) => addTracksToPlaylist(fileName, selectedList)}
          onCreateNew={(name) => createPlaylist(name, selectedList)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'rename' && singleTrack && (
        <InputModal
          title="Rename file"
          label="File name"
          initialValue={singleTrack.name.slice(0, singleTrack.name.lastIndexOf('.'))}
          confirmLabel="Rename"
          onConfirm={(value) => renameTrack(singleTrack.id, value)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'tags' && singleTrack && (
        <TagEditorModal
          track={singleTrack}
          onSave={(tags) => updateTrackTags(singleTrack.id, tags)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'autotag' && taggableSelected.length > 0 && (
        <AutoTagModal
          tracks={taggableSelected}
          skippedCount={selectedTracks.length - taggableSelected.length}
          onApply={updateTrackTags}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  );
}
