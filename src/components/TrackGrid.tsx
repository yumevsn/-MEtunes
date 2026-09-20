import type { FolderNode, TrackEntry } from '../types';
import { formatDuration } from '../lib/format';
import { FolderIcon, PauseIcon, PlayIcon } from './icons';
import { TrackArt } from './TrackArt';

interface TrackGridProps {
  tracks: TrackEntry[];
  folders: FolderNode[];
  showArt: boolean;
  selectedIds: Set<string>;
  currentTrackId: string | null;
  isPlaying: boolean;
  searching: boolean;
  emptyMessage: string;
  onToggle: (id: string, checked: boolean) => void;
  onPlay: (id: string) => void;
  onOpenFolder: (path: string) => void;
}

export function TrackGrid({
  tracks, folders, showArt, selectedIds, currentTrackId, isPlaying, searching, emptyMessage,
  onToggle, onPlay, onOpenFolder,
}: TrackGridProps) {
  if (tracks.length === 0 && folders.length === 0) {
    return <div className="grid-empty">{emptyMessage}</div>;
  }

  return (
    <div className={`song-grid ${showArt ? 'with-art' : 'no-art'}`}>
      {folders.map((folder) => (
        <button key={`folder-${folder.path}`} type="button" className="folder-tile" onClick={() => onOpenFolder(folder.path)}>
          <FolderIcon size={showArt ? 40 : 22} />
          <span className="folder-tile-name">{folder.name}</span>
          {searching && <span className="folder-tile-path">{folder.path}</span>}
        </button>
      ))}
      {tracks.map((track) => {
        const isCurrent = currentTrackId === track.id;
        const playIcon = isCurrent && isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />;
        return (
          <div
            key={track.id}
            className={`song-card ${isCurrent ? 'current' : ''} ${selectedIds.has(track.id) ? 'selected' : ''}`}
            onDoubleClick={() => onPlay(track.id)}
          >
            <input
              type="checkbox"
              className="song-card-check"
              checked={selectedIds.has(track.id)}
              onChange={(e) => onToggle(track.id, e.target.checked)}
              aria-label={`Select ${track.tags?.title || track.name}`}
            />
            {showArt ? (
              <div className="song-card-art">
                <TrackArt picture={track.tags?.picture ?? null} size={160} className="fill" />
                <button type="button" className="song-card-play" onClick={() => onPlay(track.id)} title="Play">
                  {playIcon}
                </button>
              </div>
            ) : (
              <button type="button" className="song-card-play inline" onClick={() => onPlay(track.id)} title="Play">
                {playIcon}
              </button>
            )}
            <div className="song-card-text">
              <div className="song-card-title" title={track.tags?.title || track.name}>{track.tags?.title || track.name}</div>
              <div className="song-card-artist">{track.tags?.artist || (track.tagsLoaded ? 'Unknown artist' : '…')}</div>
              {(searching || !showArt) && (
                <div className="song-card-meta">
                  {formatDuration(track.durationSec)} · {track.ext.toUpperCase()}
                  {searching && ` · ${track.dirPath || 'Device root'}`}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
