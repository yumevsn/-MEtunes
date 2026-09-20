import type { ArtistGroup } from '../lib/albums';
import { ChevronRightIcon, PlayIcon } from './icons';
import { TrackArt } from './TrackArt';

function artistArt(group: ArtistGroup) {
  return group.tracks.find((t) => t.tags?.picture)?.tags?.picture ?? null;
}

function artistName(group: ArtistGroup): string {
  return group.key === '' ? 'Unknown Artist' : group.artist;
}

function counts(group: ArtistGroup): string {
  const songs = `${group.tracks.length} ${group.tracks.length === 1 ? 'song' : 'songs'}`;
  if (group.albumCount === 0) return songs;
  return `${group.albumCount} ${group.albumCount === 1 ? 'album' : 'albums'} · ${songs}`;
}

interface ArtistGridProps {
  groups: ArtistGroup[];
  emptyMessage: string;
  onOpen: (key: string) => void;
  onPlay: (group: ArtistGroup) => void;
}

export function ArtistGrid({ groups, emptyMessage, onOpen, onPlay }: ArtistGridProps) {
  if (groups.length === 0) return <div className="grid-empty">{emptyMessage}</div>;
  return (
    <div className="album-grid artist-grid">
      {groups.map((group) => (
        <div key={group.key || 'unknown'} className="album-card artist-card">
          <div className="album-card-art">
            <button type="button" className="album-card-open" onClick={() => onOpen(group.key)} aria-label={`Open ${artistName(group)}`}>
              <TrackArt picture={artistArt(group)} size={180} className="fill" />
            </button>
            <button type="button" className="song-card-play" onClick={() => onPlay(group)} title="Play all">
              <PlayIcon size={14} />
            </button>
          </div>
          <button type="button" className="album-card-text" onClick={() => onOpen(group.key)}>
            <span className="album-card-title" title={artistName(group)}>{artistName(group)}</span>
            <span className="album-card-meta">{counts(group)}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

interface ArtistHeaderProps {
  group: ArtistGroup;
  onBack: () => void;
  onPlay: () => void;
}

export function ArtistHeader({ group, onBack, onPlay }: ArtistHeaderProps) {
  return (
    <div className="album-header">
      <button type="button" className="album-back" onClick={onBack}>
        <ChevronRightIcon size={14} className="album-back-icon" /> Artists
      </button>
      <div className="album-header-body">
        <TrackArt picture={artistArt(group)} size={120} className="round" />
        <div className="album-header-text">
          <div className="album-header-title">{artistName(group)}</div>
          <div className="album-header-meta">{counts(group)}</div>
          <button type="button" className="btn btn-primary btn-small" onClick={onPlay}>
            <PlayIcon size={12} /> Play all
          </button>
        </div>
      </div>
    </div>
  );
}
