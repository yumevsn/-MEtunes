import type { AlbumGroup } from '../lib/albums';
import { UNKNOWN_ALBUM_KEY } from '../lib/albums';
import type { TrackEntry } from '../types';
import { ChevronRightIcon, PlayIcon } from './icons';
import { TrackArt } from './TrackArt';

function albumArt(group: AlbumGroup) {
  return group.tracks.find((t) => t.tags?.picture)?.tags?.picture ?? null;
}

function totalDuration(tracks: TrackEntry[]): number {
  return tracks.reduce((sum, t) => sum + (t.durationSec ?? 0), 0);
}

function albumTitle(group: AlbumGroup): string {
  return group.key === UNKNOWN_ALBUM_KEY ? 'Unknown Album' : group.album;
}

interface AlbumGridProps {
  groups: AlbumGroup[];
  emptyMessage: string;
  onOpen: (key: string) => void;
  onPlay: (group: AlbumGroup) => void;
}

export function AlbumGrid({ groups, emptyMessage, onOpen, onPlay }: AlbumGridProps) {
  if (groups.length === 0) return <div className="grid-empty">{emptyMessage}</div>;
  return (
    <div className="album-grid">
      {groups.map((group) => (
        <div key={group.key || 'unknown'} className="album-card">
          <div className="album-card-art">
            <button type="button" className="album-card-open" onClick={() => onOpen(group.key)} aria-label={`Open ${albumTitle(group)}`}>
              <TrackArt picture={albumArt(group)} size={180} className="fill" />
            </button>
            <button type="button" className="song-card-play" onClick={() => onPlay(group)} title="Play album">
              <PlayIcon size={14} />
            </button>
          </div>
          <button type="button" className="album-card-text" onClick={() => onOpen(group.key)}>
            <span className="album-card-title" title={albumTitle(group)}>{albumTitle(group)}</span>
            <span className="album-card-artist">{group.artist || 'Unknown artist'}</span>
            <span className="album-card-meta">
              {group.year ? `${group.year} · ` : ''}{group.tracks.length} {group.tracks.length === 1 ? 'song' : 'songs'}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

interface AlbumHeaderProps {
  group: AlbumGroup;
  onBack: () => void;
  onPlay: () => void;
}

export function AlbumHeader({ group, onBack, onPlay }: AlbumHeaderProps) {
  const minutes = Math.round(totalDuration(group.tracks) / 60);
  return (
    <div className="album-header">
      <button type="button" className="album-back" onClick={onBack}>
        <ChevronRightIcon size={14} className="album-back-icon" /> Albums
      </button>
      <div className="album-header-body">
        <TrackArt picture={albumArt(group)} size={150} />
        <div className="album-header-text">
          <div className="album-header-title">{albumTitle(group)}</div>
          <div className="album-header-artist">{group.artist || 'Unknown artist'}</div>
          <div className="album-header-meta">
            {group.year ? `${group.year} · ` : ''}{group.tracks.length} {group.tracks.length === 1 ? 'song' : 'songs'}
            {minutes > 0 ? ` · ${minutes} min` : ''}
          </div>
          <button type="button" className="btn btn-primary btn-small" onClick={onPlay}>
            <PlayIcon size={12} /> Play
          </button>
        </div>
      </div>
    </div>
  );
}
