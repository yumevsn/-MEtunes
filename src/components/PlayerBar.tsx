import { useEffect, useRef, useState } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import { pictureToObjectUrl } from '../lib/metadata';
import { formatDuration } from '../lib/format';
import { ChevronUpIcon, MusicNoteIcon, NextIcon, PauseIcon, PlayIcon, PreviousIcon, VolumeIcon } from './icons';
import { NowPlayingView } from './NowPlayingView';

export function PlayerBar() {
  const currentTrackId = useLibraryStore((s) => s.currentTrackId);
  const tracksById = useLibraryStore((s) => s.tracksById);
  const isPlaying = useLibraryStore((s) => s.isPlaying);
  const setIsPlaying = useLibraryStore((s) => s.setIsPlaying);
  const setCurrentTrack = useLibraryStore((s) => s.setCurrentTrack);
  const visibleTrackIds = useLibraryStore((s) => s.visibleTrackIds);
  const isDemo = useLibraryStore((s) => s.isDemo);
  const nowPlayingOpen = useLibraryStore((s) => s.nowPlayingOpen);
  const setNowPlayingOpen = useLibraryStore((s) => s.setNowPlayingOpen);

  const audioRef = useRef<HTMLAudioElement>(null);
  const playNeighborRef = useRef<(delta: number) => void>(() => {});
  const [src, setSrc] = useState<string | null>(null);
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const track = currentTrackId ? tracksById[currentTrackId] : null;

  useEffect(() => {
    setCurrentTime(0);
    if (isDemo) {
      setSrc(null);
      setDuration(track?.durationSec ?? 180);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setDuration(0);
    (async () => {
      if (!track) { setSrc(null); return; }
      const file = await track.handle.getFile();
      if (cancelled) return;
      objectUrl = URL.createObjectURL(file);
      setSrc(objectUrl);
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [track?.id, isDemo]);

  useEffect(() => {
    const picture = track?.tags?.picture ?? null;
    const url = pictureToObjectUrl(picture);
    setArtUrl(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [track?.tags?.picture]);

  useEffect(() => {
    if (isDemo) return;
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, src, isDemo, setIsPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!isDemo || !isPlaying || !track) return;
    const targetDuration = track.durationSec ?? 180;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 1;
        if (next >= targetDuration) {
          playNeighborRef.current(1);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, isPlaying, track?.id]);

  function playNeighbor(delta: number) {
    if (!currentTrackId) return;
    const idx = visibleTrackIds.indexOf(currentTrackId);
    if (idx === -1) return;
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= visibleTrackIds.length) return;
    setCurrentTrack(visibleTrackIds[nextIdx]);
  }
  playNeighborRef.current = playNeighbor;

  function handleSeek(value: number) {
    if (!isDemo && audioRef.current) audioRef.current.currentTime = value;
    setCurrentTime(value);
  }

  const volumeLevel = volume === 0 ? 'muted' : volume < 0.5 ? 'low' : 'high';

  return (
    <>
      <footer className="player-bar">
        <audio
          ref={audioRef}
          src={src ?? undefined}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => playNeighbor(1)}
        />
        <button
          type="button"
          className="player-track-info"
          disabled={!track}
          onClick={() => setNowPlayingOpen(true)}
          title={track ? 'Open Now Playing' : undefined}
        >
          <div className="player-art">
            {artUrl ? <img src={artUrl} alt="" /> : <MusicNoteIcon size={18} />}
          </div>
          <div className="player-text">
            <div className="player-title">{track ? (track.tags?.title || track.name) : 'Not Playing'}</div>
            <div className="player-artist">
              {track?.tags?.artist || ''}
              {isDemo && track && ' · simulated audio'}
            </div>
          </div>
          {track && <ChevronUpIcon size={14} className="player-expand-icon" />}
        </button>

        <div className="player-controls">
          <div className="player-buttons">
            <button type="button" className="transport-btn" onClick={() => playNeighbor(-1)} disabled={!track}>
              <PreviousIcon size={18} />
            </button>
            <button
              type="button"
              className="transport-btn transport-play"
              disabled={!track}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
            </button>
            <button type="button" className="transport-btn" onClick={() => playNeighbor(1)} disabled={!track}>
              <NextIcon size={18} />
            </button>
          </div>
          <div className="player-seek">
            <span className="time-label">{formatDuration(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={Math.min(currentTime, duration || 0)}
              onChange={(e) => handleSeek(Number(e.target.value))}
              disabled={!track}
            />
            <span className="time-label">{formatDuration(duration)}</span>
          </div>
        </div>

        <div className="player-volume">
          <VolumeIcon size={16} level={volumeLevel} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </div>
      </footer>

      {nowPlayingOpen && track && (
        <NowPlayingView
          track={track}
          artUrl={artUrl}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          isDemo={isDemo}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          onPrev={() => playNeighbor(-1)}
          onNext={() => playNeighbor(1)}
          onSeek={handleSeek}
          onVolumeChange={setVolume}
          onClose={() => setNowPlayingOpen(false)}
        />
      )}
    </>
  );
}
