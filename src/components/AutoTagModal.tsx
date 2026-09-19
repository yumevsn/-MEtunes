import { useRef, useState } from 'react';
import type { TrackEntry, TrackTags } from '../types';
import { searchRecording, yearFromReleaseDate, type MusicBrainzMatch } from '../lib/musicbrainz';
import { fetchCoverArt } from '../lib/coverArt';
import { AUTO_ACCEPT_SCORE, guessQueryFromTrack, mergeMatchIntoTags } from '../lib/autotag';
import { pictureToObjectUrl } from '../lib/metadata';
import { Modal } from './Modal';
import { MusicNoteIcon } from './icons';

interface AutoTagModalProps {
  tracks: TrackEntry[];
  skippedCount: number;
  onApply: (trackId: string, tags: TrackTags) => Promise<void>;
  onClose: () => void;
}

const EMPTY_TAGS: TrackTags = {
  title: '', artist: '', album: '', albumArtist: '', track: '', year: '', genre: '', picture: null,
};

type BulkStatus = 'pending' | 'searching' | 'matched' | 'no-match' | 'error';

export function AutoTagModal({ tracks, skippedCount, onApply, onClose }: AutoTagModalProps) {
  if (tracks.length === 1) {
    return (
      <SingleTrackAutoTag track={tracks[0]} skippedCount={skippedCount} onApply={onApply} onClose={onClose} />
    );
  }
  return <BulkAutoTag tracks={tracks} skippedCount={skippedCount} onApply={onApply} onClose={onClose} />;
}

function SingleTrackAutoTag({ track, skippedCount, onApply, onClose }: {
  track: TrackEntry;
  skippedCount: number;
  onApply: (trackId: string, tags: TrackTags) => Promise<void>;
  onClose: () => void;
}) {
  const guess = guessQueryFromTrack(track.name, track.tags);
  const [title, setTitle] = useState(guess.title);
  const [artist, setArtist] = useState(guess.artist || track.tags?.artist || '');
  const [album, setAlbum] = useState(track.tags?.album || '');
  const [results, setResults] = useState<MusicBrainzMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewTags, setPreviewTags] = useState<TrackTags | null>(null);
  const [applying, setApplying] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    setPreviewTags(null);
    try {
      const matches = await searchRecording({ title, artist, album });
      setResults(matches);
      if (matches.length === 0) setError('No matches found on MusicBrainz. Try adjusting the search fields.');
    } catch {
      setError('Lookup failed. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  }

  async function pickMatch(match: MusicBrainzMatch) {
    const art = match.releaseId ? await fetchCoverArt(match.releaseId) : null;
    setPreviewTags(mergeMatchIntoTags(track.tags ?? { ...EMPTY_TAGS, title: track.name }, match, art));
  }

  async function handleApply() {
    if (!previewTags) return;
    setApplying(true);
    try {
      await onApply(track.id, previewTags);
      onClose();
    } finally {
      setApplying(false);
    }
  }

  const artUrl = previewTags ? pictureToObjectUrl(previewTags.picture) : null;

  return (
    <Modal title={`Auto-tag — ${track.name}`} onClose={onClose} width={520}>
      {skippedCount > 0 && (
        <p className="modal-note">{skippedCount} non-MP3 file(s) in your selection were skipped (tags can only be written to MP3 right now).</p>
      )}
      <form onSubmit={handleSearch} className="autotag-search-form">
        <div className="field-row">
          <label className="field"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="field"><span>Artist</span><input value={artist} onChange={(e) => setArtist(e.target.value)} /></label>
        </div>
        <label className="field"><span>Album (optional)</span><input value={album} onChange={(e) => setAlbum(e.target.value)} /></label>
        <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="submit" className="btn btn-primary btn-small" disabled={searching || !title.trim()}>
            {searching ? 'Searching…' : 'Search MusicBrainz'}
          </button>
        </div>
      </form>

      {error && <div className="banner banner-error">{error}</div>}

      {results.length > 0 && !previewTags && (
        <ul className="picker-list autotag-results">
          {results.map((match) => (
            <li key={match.recordingId}>
              <button type="button" className="picker-item autotag-result" onClick={() => pickMatch(match)}>
                <span className="autotag-result-main">
                  <strong>{match.title}</strong> — {match.artist || 'Unknown artist'}
                </span>
                <span className="autotag-result-sub">
                  {match.releaseTitle || 'Unknown album'}{yearFromReleaseDate(match.releaseDate) ? ` (${yearFromReleaseDate(match.releaseDate)})` : ''} · match {match.score}%
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {previewTags && (
        <div className="autotag-preview">
          <div className="tag-form-grid">
            <div className="art-picker">
              <div className="art-preview">
                {artUrl ? <img src={artUrl} alt="Album art" /> : <div className="art-placeholder"><MusicNoteIcon size={28} /></div>}
              </div>
            </div>
            <div className="tag-fields">
              <div><strong>{previewTags.title}</strong></div>
              <div>{previewTags.artist}</div>
              <div className="text-muted">{previewTags.album}{previewTags.year ? ` · ${previewTags.year}` : ''}</div>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setPreviewTags(null)}>Back to results</button>
            <button type="button" className="btn btn-primary" disabled={applying} onClick={handleApply}>
              {applying ? 'Applying…' : 'Apply tags'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function BulkAutoTag({ tracks, skippedCount, onApply, onClose }: {
  tracks: TrackEntry[];
  skippedCount: number;
  onApply: (trackId: string, tags: TrackTags) => Promise<void>;
  onClose: () => void;
}) {
  const [statuses, setStatuses] = useState<Record<string, { status: BulkStatus; label?: string }>>({});
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const cancelledRef = useRef(false);

  async function start() {
    setRunning(true);
    setDone(false);
    cancelledRef.current = false;
    const next: Record<string, { status: BulkStatus; label?: string }> = {};
    for (const track of tracks) next[track.id] = { status: 'pending' };
    setStatuses({ ...next });

    for (const track of tracks) {
      if (cancelledRef.current) break;
      setStatuses((prev) => ({ ...prev, [track.id]: { status: 'searching' } }));
      try {
        const guess = guessQueryFromTrack(track.name, track.tags);
        const matches = await searchRecording({
          title: guess.title,
          artist: guess.artist || track.tags?.artist || '',
          album: track.tags?.album || '',
        });
        const top = matches[0];
        if (top && top.score >= AUTO_ACCEPT_SCORE) {
          const art = top.releaseId ? await fetchCoverArt(top.releaseId) : null;
          const merged = mergeMatchIntoTags(track.tags ?? { ...EMPTY_TAGS, title: track.name }, top, art);
          await onApply(track.id, merged);
          setStatuses((prev) => ({ ...prev, [track.id]: { status: 'matched', label: `${merged.artist} — ${merged.title}` } }));
        } else {
          setStatuses((prev) => ({ ...prev, [track.id]: { status: 'no-match' } }));
        }
      } catch {
        setStatuses((prev) => ({ ...prev, [track.id]: { status: 'error' } }));
      }
    }
    setRunning(false);
    setDone(true);
  }

  const counts = Object.values(statuses).reduce(
    (acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }),
    {} as Record<BulkStatus, number>,
  );

  return (
    <Modal title={`Auto-tag ${tracks.length} file(s)`} onClose={onClose} width={520}>
      {skippedCount > 0 && (
        <p className="modal-note">{skippedCount} non-MP3 file(s) in your selection were skipped (tags can only be written to MP3 right now).</p>
      )}
      <p className="modal-note">
        Looks each file up on MusicBrainz using its existing tags (or filename) and only auto-applies a match when
        it's confident (score ≥ {AUTO_ACCEPT_SCORE}%). This runs one lookup at a time to stay within MusicBrainz's
        free-usage limits, so it may take a little while for a large selection.
      </p>

      {!running && !done && (
        <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="btn btn-primary" onClick={start}>Start Auto-Tag</button>
        </div>
      )}

      {(running || done) && (
        <>
          <ul className="autotag-bulk-list">
            {tracks.map((track) => {
              const state = statuses[track.id];
              return (
                <li key={track.id} className={`autotag-bulk-row status-${state?.status ?? 'pending'}`}>
                  <span className="autotag-bulk-name" title={track.name}>{track.name}</span>
                  <span className="autotag-bulk-status">
                    {state?.status === 'searching' && 'Searching…'}
                    {state?.status === 'matched' && `✓ ${state.label}`}
                    {state?.status === 'no-match' && 'No confident match'}
                    {state?.status === 'error' && 'Lookup failed'}
                    {(!state || state.status === 'pending') && 'Waiting…'}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="modal-actions">
            {running && (
              <button type="button" className="btn" onClick={() => { cancelledRef.current = true; }}>Cancel</button>
            )}
            {done && (
              <>
                <span className="autotag-summary">
                  {counts.matched ?? 0} tagged · {counts['no-match'] ?? 0} no match · {counts.error ?? 0} failed
                </span>
                <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
