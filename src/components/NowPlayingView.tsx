import { useLibraryStore } from '../store/useLibraryStore';
import type { TrackEntry } from '../types';
import { formatDuration } from '../lib/format';
import {
  ChevronDownIcon, NextIcon, PauseIcon, PlayIcon, PreviousIcon, VolumeIcon, MusicNoteIcon,
} from './icons';

interface NowPlayingViewProps {
  track: TrackEntry;
  artUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isDemo: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (value: number) => void;
  onVolumeChange: (value: number) => void;
  onClose: () => void;
}

export function NowPlayingView({
  track, artUrl, isPlaying, currentTime, duration, volume, isDemo,
  onTogglePlay, onPrev, onNext, onSeek, onVolumeChange, onClose,
}: NowPlayingViewProps) {
  const visibleTrackIds = useLibraryStore((s) => s.visibleTrackIds);
  const tracksById = useLibraryStore((s) => s.tracksById);
  const setCurrentTrack = useLibraryStore((s) => s.setCurrentTrack);
  const setIsPlaying = useLibraryStore((s) => s.setIsPlaying);

  const queueIndex = visibleTrackIds.indexOf(track.id);
  const upNext = queueIndex === -1 ? [] : visibleTrackIds.slice(queueIndex + 1, queueIndex + 21);

  function playFromQueue(id: string) {
    setCurrentTrack(id);
    setIsPlaying(true);
  }

  return (
    <div className="now-playing-overlay">
      <button type="button" className="now-playing-close" onClick={onClose} title="Minimize">
        <ChevronDownIcon size={22} />
      </button>

      <div className="now-playing-content">
        <div className="now-playing-art">
          {artUrl ? <img src={artUrl} alt="" /> : <MusicNoteIcon size={72} />}
        </div>

        <div className="now-playing-info">
          <div className="now-playing-title">{track.tags?.title || track.name}</div>
          <div className="now-playing-artist">{track.tags?.artist || 'Unknown Artist'}</div>
          <div className="now-playing-album">
            {track.tags?.album || ''}
            {isDemo ? ' · simulated audio' : ''}
          </div>
        </div>

        <div className="now-playing-seek">
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => onSeek(Number(e.target.value))}
          />
          <div className="now-playing-times">
            <span>{formatDuration(currentTime)}</span>
            <span>-{formatDuration(Math.max(0, duration - currentTime))}</span>
          </div>
        </div>

        <div className="now-playing-transport">
          <button type="button" className="transport-btn" onClick={onPrev}><PreviousIcon size={26} /></button>
          <button type="button" className="transport-btn transport-play large" onClick={onTogglePlay}>
            {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
          </button>
          <button type="button" className="transport-btn" onClick={onNext}><NextIcon size={26} /></button>
        </div>

        <div className="now-playing-volume">
          <VolumeIcon size={15} level="low" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
          />
          <VolumeIcon size={17} level="high" />
        </div>

        {upNext.length > 0 && (
          <div className="now-playing-queue">
            <div className="now-playing-queue-heading">Up Next</div>
            <ul>
              {upNext.map((id) => {
                const t = tracksById[id];
                if (!t) return null;
                return (
                  <li key={id}>
                    <button type="button" className="queue-item" onClick={() => playFromQueue(id)}>
                      <span className="queue-item-title">{t.tags?.title || t.name}</span>
                      <span className="queue-item-artist">{t.tags?.artist || ''}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
