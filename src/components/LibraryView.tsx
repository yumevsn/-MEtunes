import { useEffect, useMemo, useRef, useState } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import type { FolderNode, TrackEntry } from '../types';
import { CATEGORY_LABELS } from '../types';
import { baseName, formatBytes, formatDuration } from '../lib/format';
import { findFolderNode, flattenFolders } from '../lib/fsAccess';
import { IMPORT_ACCEPT, itemsFromFileList } from '../lib/importFiles';
import { groupByAlbum, groupByArtist, type AlbumGroup, type ArtistGroup } from '../lib/albums';
import { NewFolderModal } from './NewFolderModal';
import { FolderPickerModal } from './FolderPickerModal';
import { PlaylistPickerModal } from './PlaylistPickerModal';
import { InputModal } from './InputModal';
import { TagEditorModal } from './TagEditorModal';
import { AutoTagModal } from './AutoTagModal';
import { AlbumModal } from './AlbumModal';
import { FindAlbumsModal } from './FindAlbumsModal';
import { AlbumGrid, AlbumHeader } from './AlbumGrid';
import { ArtistGrid, ArtistHeader } from './ArtistGrid';
import { TrackGrid } from './TrackGrid';
import { TrackArt } from './TrackArt';
import {
  AlbumIcon, ArtistIcon, ChevronDownIcon, ChevronUpIcon, FolderIcon, GridViewIcon, ImageIcon, ImportIcon,
  ListViewIcon, MenuIcon, MusicNoteIcon, PauseIcon, PlayIcon, SearchIcon, XIcon,
} from './icons';

type SortKey = 'title' | 'artist' | 'album' | 'duration' | 'format' | 'size';

const SORT_LABELS: Record<SortKey, string> = {
  title: 'Title', artist: 'Artist', album: 'Album', duration: 'Time', format: 'Format', size: 'Size',
};

type BrowseBy = 'songs' | 'albums' | 'artists';

const BROWSE_OPTIONS: Array<{ by: BrowseBy; label: string; Icon: typeof ListViewIcon }> = [
  { by: 'songs', label: 'Songs', Icon: MusicNoteIcon },
  { by: 'albums', label: 'Albums', Icon: AlbumIcon },
  { by: 'artists', label: 'Artists', Icon: ArtistIcon },
];

const LAYOUT_OPTIONS: Array<{ mode: 'list' | 'grid'; label: string; Icon: typeof ListViewIcon }> = [
  { mode: 'list', label: 'List', Icon: ListViewIcon },
  { mode: 'grid', label: 'Grid', Icon: GridViewIcon },
];

const folderInputProps = { webkitdirectory: '' } as Record<string, string>;

function trackHaystack(t: TrackEntry): string {
  return [t.tags?.title, t.tags?.artist, t.tags?.albumArtist, t.tags?.album, t.tags?.genre, t.name, baseName(t.dirPath)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

type ModalName = null | 'newFolder' | 'move' | 'playlist' | 'rename' | 'tags' | 'autotag' | 'album' | 'albumInfo' | 'findAlbums';

export function LibraryView() {
  const selectedView = useLibraryStore((s) => s.selectedView);
  const tracksById = useLibraryStore((s) => s.tracksById);
  const trackOrder = useLibraryStore((s) => s.trackOrder);
  const playlists = useLibraryStore((s) => s.playlists);
  const folderTree = useLibraryStore((s) => s.folderTree);
  const searchQuery = useLibraryStore((s) => s.searchQuery);
  const viewMode = useLibraryStore((s) => s.viewMode);
  const songLayout = useLibraryStore((s) => s.songLayout);
  const showArt = useLibraryStore((s) => s.showArt);
  const setViewMode = useLibraryStore((s) => s.setViewMode);
  const setShowArt = useLibraryStore((s) => s.setShowArt);
  const setSearchQuery = useLibraryStore((s) => s.setSearchQuery);
  const setSelectedView = useLibraryStore((s) => s.setSelectedView);
  const setSidebarOpen = useLibraryStore((s) => s.setSidebarOpen);
  const setPendingImport = useLibraryStore((s) => s.setPendingImport);
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
  const [modal, setModal] = useState<ModalName>(null);
  const [openAlbumKey, setOpenAlbumKey] = useState<string | null>(null);
  const [openArtistKey, setOpenArtistKey] = useState<string | null>(null);
  const [albumSeed, setAlbumSeed] = useState<{ tracks: TrackEntry[]; album?: string; artist?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedIds(new Set());
    setOpenAlbumKey(null);
    setOpenArtistKey(null);
  }, [selectedView, viewMode]);

  const terms = useMemo(() => searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean), [searchQuery]);
  const searching = terms.length > 0;

  const currentPlaylist = selectedView.type === 'playlist'
    ? playlists.find((p) => p.fileName === selectedView.fileName) ?? null
    : null;

  const currentFolderNode = selectedView.type === 'folder' && folderTree
    ? findFolderNode(folderTree, selectedView.path) ?? null
    : null;

  // A search looks through the whole device, not just the section or folder you happen to be in.
  const baseTracks: TrackEntry[] = useMemo(() => {
    if (searching) return trackOrder.map((id) => tracksById[id]);
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
  }, [searching, selectedView, currentPlaylist, tracksById, trackOrder]);

  const tracks = useMemo(() => {
    let list = baseTracks;
    if (searching) {
      list = list.filter((t) => {
        const haystack = trackHaystack(t);
        return terms.every((term) => haystack.includes(term));
      });
    }
    return [...list].sort((a, b) => {
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
  }, [baseTracks, searching, terms, sort]);

  const folderRows: FolderNode[] = useMemo(() => {
    if (searching) {
      if (!folderTree) return [];
      return flattenFolders(folderTree)
        .filter((f) => f.path && terms.every((term) => f.name.toLowerCase().includes(term)))
        .slice(0, 25);
    }
    return currentFolderNode?.children ?? [];
  }, [searching, terms, folderTree, currentFolderNode]);

  const albumGroups: AlbumGroup[] = useMemo(
    () => (viewMode === 'albums' ? groupByAlbum(tracks) : []),
    [viewMode, tracks],
  );
  const openGroup = viewMode === 'albums' && openAlbumKey !== null
    ? albumGroups.find((g) => g.key === openAlbumKey) ?? null
    : null;

  const artistGroups: ArtistGroup[] = useMemo(
    () => (viewMode === 'artists' ? groupByArtist(tracks) : []),
    [viewMode, tracks],
  );
  const openArtist = viewMode === 'artists' && openArtistKey !== null
    ? artistGroups.find((g) => g.key === openArtistKey) ?? null
    : null;

  // 'table' is the song list plus an opened album or artist; the other layouts show cards instead of rows.
  const layout: 'table' | 'grid' | 'albums' | 'artists' =
    viewMode === 'list' || openGroup || openArtist
      ? 'table'
      : viewMode === 'grid' ? 'grid' : viewMode === 'albums' ? 'albums' : 'artists';
  const openedTracks = openGroup?.tracks ?? openArtist?.tracks ?? null;
  const shownTracks = viewMode === 'albums' || viewMode === 'artists' ? (openedTracks ?? []) : tracks;
  // Next/previous follow what's on screen: group by group in the card grids, otherwise the visible rows.
  const queueTracks = useMemo(() => {
    if (viewMode === 'albums') return openGroup ? openGroup.tracks : albumGroups.flatMap((g) => g.tracks);
    if (viewMode === 'artists') return openArtist ? openArtist.tracks : artistGroups.flatMap((g) => g.tracks);
    return tracks;
  }, [viewMode, openGroup, openArtist, albumGroups, artistGroups, tracks]);

  useEffect(() => {
    setVisibleTrackIds(queueTracks.map((t) => t.id));
  }, [queueTracks, setVisibleTrackIds]);

  const heading = selectedView.type === 'category'
    ? CATEGORY_LABELS[selectedView.category]
    : selectedView.type === 'playlist'
      ? (currentPlaylist?.name ?? 'Playlist')
      : '';
  const breadcrumb = !searching && selectedView.type === 'folder'
    ? ['Device root', ...(selectedView.path ? selectedView.path.split('/') : [])]
    : null;

  // Only rows you can currently see count as selected, so a search can't leave hidden files
  // queued up for Delete/Move.
  const selectedList = shownTracks.filter((t) => selectedIds.has(t.id)).map((t) => t.id);
  const selectedCount = selectedList.length;
  const singleTrack = selectedCount === 1 ? tracksById[selectedList[0]] : null;
  const selectedTracks = selectedList.map((id) => tracksById[id]).filter(Boolean);
  const taggableSelected = selectedTracks.filter((t) => t.canWriteTags);
  const folderAlbumTracks = selectedView.type === 'folder' && !searching
    ? tracks.filter((t) => t.kind === 'audio')
    : [];

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(shownTracks.map((t) => t.id)) : new Set());
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

  function handlePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) setPendingImport(itemsFromFileList(files));
    e.target.value = '';
  }

  function openAlbumWizard(seedTracks: TrackEntry[], seed: { album?: string; artist?: string } = {}) {
    setAlbumSeed({ tracks: seedTracks, ...seed });
    setModal('album');
  }

  const emptyMessage = searching
    ? `Nothing on the device matches “${searchQuery.trim()}”.`
    : selectedView.type === 'playlist'
      ? 'This playlist is empty. Add tracks from a library view.'
      : selectedView.type === 'folder'
        ? 'This folder is empty. Drag songs here or use Import.'
        : 'No files in this section yet. Drag songs here or use Import.';

  const showSortControl = layout === 'grid';
  const inTable = layout === 'table';
  const browseBy: BrowseBy = viewMode === 'albums' ? 'albums' : viewMode === 'artists' ? 'artists' : 'songs';
  // Album/artist cards always show their cover; the toggle only affects song rows and tiles.
  const artToggleDisabled = viewMode === 'albums' || layout === 'artists';

  function browse(by: BrowseBy) {
    setViewMode(by === 'songs' ? songLayout : by);
  }

  return (
    <section className="library-view">
      <header className="library-header">
        <div className="library-title-row">
          <button type="button" className="menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <MenuIcon size={20} />
          </button>
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
          ) : searching ? (
            <h1 className="search-heading">
              Search
              <span className="heading-sub">
                {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
                {folderRows.length > 0 && `, ${folderRows.length} ${folderRows.length === 1 ? 'folder' : 'folders'}`}
              </span>
            </h1>
          ) : (
            <h1>{heading}</h1>
          )}
        </div>

        <div className="header-controls">
          <div className="view-switcher" role="group" aria-label="Browse by">
            {BROWSE_OPTIONS.map(({ by, label, Icon }) => (
              <button
                key={by}
                type="button"
                className={`view-btn ${browseBy === by ? 'active' : ''}`}
                onClick={() => browse(by)}
                aria-pressed={browseBy === by}
                title={`Browse ${label.toLowerCase()}`}
              >
                <Icon size={15} />
                <span className="view-btn-label">{label}</span>
              </button>
            ))}
          </div>
          {browseBy === 'songs' && (
            <div className="view-switcher" role="group" aria-label="Song layout">
              {LAYOUT_OPTIONS.map(({ mode, label, Icon }) => (
                <button
                  key={mode}
                  type="button"
                  className={`view-btn ${viewMode === mode ? 'active' : ''}`}
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  title={`${label} view`}
                >
                  <Icon size={15} />
                  <span className="view-btn-label">{label}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className={`view-btn art-toggle ${showArt && !artToggleDisabled ? 'active' : ''}`}
            onClick={() => setShowArt(!showArt)}
            aria-pressed={showArt}
            disabled={artToggleDisabled}
            title={artToggleDisabled ? 'Albums and artists always show their cover' : showArt ? 'Hide album art' : 'Show album art'}
          >
            <ImageIcon size={15} />
            <span className="view-btn-label">Art</span>
          </button>
          {showSortControl && (
            <div className="sort-control">
              <select value={sort.key} onChange={(e) => setSort((prev) => ({ ...prev, key: e.target.value as SortKey }))} aria-label="Sort by">
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => <option key={key} value={key}>{SORT_LABELS[key]}</option>)}
              </select>
              <button
                type="button"
                className="view-btn"
                onClick={() => setSort((prev) => ({ ...prev, dir: prev.dir === 1 ? -1 : 1 }))}
                title={sort.dir === 1 ? 'Ascending' : 'Descending'}
              >
                {sort.dir === 1 ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
              </button>
            </div>
          )}
          <div className="search-field">
            <SearchIcon size={14} className="search-field-icon" />
            <input
              className="search-input"
              placeholder="Search the whole device…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery(''); }}
            />
            {searchQuery && (
              <button type="button" className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
                <XIcon size={12} />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="library-toolbar">
        <div className="toolbar-group">
          <button type="button" className="btn btn-small btn-primary" onClick={() => fileInputRef.current?.click()}>
            <ImportIcon size={13} /> Import
          </button>
          <button type="button" className="btn btn-small desktop-only" onClick={() => folderInputRef.current?.click()}>
            Import Folder
          </button>
          <button type="button" className="btn btn-small" onClick={() => setModal('newFolder')}>New Folder</button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => openAlbumWizard(selectedTracks.filter((t) => t.kind === 'audio'))}
            title="Group songs into an album folder and fill in missing info"
          >
            <AlbumIcon size={13} /> Create Album
          </button>
          <button type="button" className="btn btn-small" onClick={() => setModal('findAlbums')} title="Find songs that aren’t in an album folder">
            Find Albums
          </button>
          {folderAlbumTracks.length > 0 && (
            <button type="button" className="btn btn-small" onClick={() => setModal('albumInfo')} title="Fill in missing album info for the songs in this folder">
              Album Info
            </button>
          )}
        </div>
        <div className="toolbar-group">
          <button type="button" className="btn btn-small" disabled={selectedCount === 0} onClick={() => setModal('playlist')}>
            Add to Playlist
          </button>
          <button type="button" className="btn btn-small" disabled={selectedCount === 0 || !folderTree} onClick={() => setModal('move')}>
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
          {selectedView.type === 'playlist' && !searching && (
            <button
              type="button"
              className="btn btn-small"
              disabled={selectedCount === 0}
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
            disabled={selectedCount === 0}
            onClick={() => {
              if (confirm(`Delete ${selectedCount} file(s) from the device? This cannot be undone.`)) {
                deleteTracks(selectedList);
                setSelectedIds(new Set());
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple accept={IMPORT_ACCEPT} hidden onChange={handlePicked} />
      <input ref={folderInputRef} type="file" multiple hidden onChange={handlePicked} {...folderInputProps} />

      <div className="track-table-wrap">
        {openGroup && (
          <AlbumHeader
            group={openGroup}
            onBack={() => setOpenAlbumKey(null)}
            onPlay={() => playTrack(openGroup.tracks[0].id)}
          />
        )}

        {openArtist && (
          <ArtistHeader
            group={openArtist}
            onBack={() => setOpenArtistKey(null)}
            onPlay={() => playTrack(openArtist.tracks[0].id)}
          />
        )}

        {layout === 'artists' && (
          <ArtistGrid
            groups={artistGroups}
            emptyMessage={emptyMessage}
            onOpen={setOpenArtistKey}
            onPlay={(group) => playTrack(group.tracks[0].id)}
          />
        )}

        {layout === 'albums' && (
          <AlbumGrid
            groups={albumGroups}
            emptyMessage={emptyMessage}
            onOpen={setOpenAlbumKey}
            onPlay={(group) => playTrack(group.tracks[0].id)}
          />
        )}

        {layout === 'grid' && (
          <TrackGrid
            tracks={tracks}
            folders={folderRows}
            showArt={showArt}
            selectedIds={selectedIds}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            searching={searching}
            emptyMessage={emptyMessage}
            onToggle={toggleSelect}
            onPlay={playTrack}
            onOpenFolder={(path) => setSelectedView({ type: 'folder', path })}
          />
        )}

        {inTable && (
          <table className="track-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={shownTracks.length > 0 && selectedCount === shownTracks.length}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    aria-label="Select all"
                  />
                </th>
                <th></th>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <th
                    key={key}
                    onClick={openGroup ? undefined : () => sortBy(key)}
                    className={`col-${key} ${openGroup ? '' : 'sortable'}`}
                  >
                    <span className="th-label">
                      {SORT_LABELS[key]}
                      {!openGroup && sort.key === key && (sort.dir === 1 ? <ChevronUpIcon size={11} /> : <ChevronDownIcon size={11} />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!openGroup && folderRows.map((child) => (
                <tr
                  key={`folder-${child.path}`}
                  className="row-folder"
                  onClick={() => setSelectedView({ type: 'folder', path: child.path })}
                >
                  <td className="col-check"></td>
                  <td className="col-play"></td>
                  <td colSpan={6}>
                    <span className="folder-cell">
                      <FolderIcon size={15} /> {child.name}
                      {searching && <span className="folder-path">{child.path}</span>}
                    </span>
                  </td>
                </tr>
              ))}
              {shownTracks.map((track) => (
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
                      aria-label={`Select ${track.tags?.title || track.name}`}
                    />
                  </td>
                  <td className="col-play">
                    <button type="button" className="play-btn" onClick={() => playTrack(track.id)} title="Play">
                      {currentTrackId === track.id && isPlaying ? <PauseIcon size={11} /> : <PlayIcon size={11} />}
                    </button>
                  </td>
                  <td className="col-title">
                    <div className="title-cell">
                      {showArt && !openGroup && <TrackArt picture={track.tags?.picture ?? null} size={34} />}
                      <div className="title-cell-text">
                        <div className="title-cell-name">{track.tags?.title || track.name}</div>
                        <div className="title-sub">{[track.tags?.artist, track.tags?.album].filter(Boolean).join(' · ')}</div>
                        {searching && <div className="track-path">{track.dirPath || 'Device root'}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="col-artist">{track.tags?.artist || (track.tagsLoaded ? '—' : '…')}</td>
                  <td className="col-album">{track.tags?.album || (track.tagsLoaded ? '—' : '…')}</td>
                  <td className="col-duration">{formatDuration(track.durationSec)}</td>
                  <td className="col-format">{track.ext.toUpperCase()}</td>
                  <td className="col-size">{formatBytes(track.size)}</td>
                </tr>
              ))}
              {shownTracks.length === 0 && (openGroup || folderRows.length === 0) && (
                <tr>
                  <td colSpan={8} className="empty-row">{emptyMessage}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
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
      {modal === 'album' && albumSeed && (
        <AlbumModal
          mode="create"
          initialTracks={albumSeed.tracks}
          seed={{ album: albumSeed.album, artist: albumSeed.artist }}
          onClose={() => { setModal(null); setAlbumSeed(null); }}
        />
      )}
      {modal === 'albumInfo' && selectedView.type === 'folder' && (
        <AlbumModal
          mode="existing"
          initialTracks={folderAlbumTracks}
          folderPath={selectedView.path}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'findAlbums' && (
        <FindAlbumsModal onOpenAlbum={openAlbumWizard} onClose={() => setModal(null)} />
      )}
    </section>
  );
}
