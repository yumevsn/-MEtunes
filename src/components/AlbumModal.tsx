import { useMemo, useRef, useState } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import type { AlbumApplyResult, TrackEntry } from '../types';
import {
  albumKeyOf, buildAlbumTags, clusterByArtist, fieldsFromRelease, findLooseTracks, groupByAlbum, matchToTracklist,
  normalizeText, rankReleases, sanitizeFolderName, sectionFolderFor, suggestFolderName, UNKNOWN_ALBUM_KEY,
} from '../lib/albums';
import { flattenFolders } from '../lib/fsAccess';
import { fetchAlbumArt, type FetchedArt } from '../lib/coverArt';
import { baseName } from '../lib/format';
import { getRelease, searchReleases, yearFromReleaseDate, type ReleaseCandidate, type ReleaseDetails } from '../lib/musicbrainz';
import { getArtUrl } from '../lib/artCache';
import { Modal } from './Modal';
import { MusicNoteIcon } from './icons';

interface AlbumModalProps {
  // create: move the songs into a new album folder. existing: fill in info for songs already in a folder.
  mode: 'create' | 'existing';
  initialTracks: TrackEntry[];
  folderPath?: string;
  seed?: { album?: string; artist?: string };
  onClose: () => void;
}

function initialFields(tracks: TrackEntry[], mode: 'create' | 'existing', folderPath: string | undefined, seed: AlbumModalProps['seed']) {
  const known = groupByAlbum(tracks)
    .filter((g) => g.key !== UNKNOWN_ALBUM_KEY)
    .sort((a, b) => b.tracks.length - a.tracks.length)[0];
  const artist = seed?.artist ?? known?.artist ?? clusterByArtist(tracks)[0]?.artist ?? '';
  const album = seed?.album ?? known?.album ?? (mode === 'existing' && folderPath ? baseName(folderPath) : '');
  return { album, artist, year: known?.year ?? '' };
}

export function AlbumModal({ mode, initialTracks, folderPath, seed, onClose }: AlbumModalProps) {
  const tracksById = useLibraryStore((s) => s.tracksById);
  const trackOrder = useLibraryStore((s) => s.trackOrder);
  const folderTree = useLibraryStore((s) => s.folderTree);
  const config = useLibraryStore((s) => s.config);
  const applyAlbumPlan = useLibraryStore((s) => s.applyAlbumPlan);

  const [initial] = useState(() => initialFields(initialTracks, mode, folderPath, seed));
  const [album, setAlbum] = useState(initial.album);
  const [artist, setArtist] = useState(initial.artist);
  const [year, setYear] = useState(initial.year);
  const [songs, setSongs] = useState<TrackEntry[]>(initialTracks);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [folderName, setFolderName] = useState(() => suggestFolderName(initial.artist, initial.album));
  const [folderEdited, setFolderEdited] = useState(false);
  const [parent, setParent] = useState(() => {
    const dirs = new Set(initialTracks.map((t) => t.dirPath));
    const only = dirs.size === 1 ? [...dirs][0] : '';
    // Loose songs sitting in Music/ get their album folder inside Music/.
    return only && !only.includes('/') ? only : sectionFolderFor(folderTree, 'music');
  });
  const [fillOnly, setFillOnly] = useState(true);

  const [candidates, setCandidates] = useState<ReleaseCandidate[] | null>(null);
  const [busy, setBusy] = useState<null | 'searching' | 'loading'>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [release, setRelease] = useState<ReleaseDetails | null>(null);
  const [art, setArt] = useState<FetchedArt | null>(null);
  const [addedFromDevice, setAddedFromDevice] = useState(0);

  const [phase, setPhase] = useState<'edit' | 'working' | 'done'>('edit');
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' });
  const [stopping, setStopping] = useState(false);
  const [result, setResult] = useState<AlbumApplyResult | null>(null);
  const cancelRef = useRef(false);

  const included = useMemo(() => songs.filter((s) => !excluded.has(s.id)), [songs, excluded]);
  const matches = useMemo(
    () => (release ? matchToTracklist(included, release.tracks) : new Map()),
    [release, included],
  );
  const untaggable = included.filter((s) => !s.canWriteTags).length;
  const distinctAlbums = new Set(included.map((s) => normalizeText(s.tags?.album ?? '')).filter(Boolean)).size;
  const artUrl = art ? getArtUrl({ format: art.format, data: art.data }) : null;
  const targetPath = mode === 'create'
    ? [parent, sanitizeFolderName(folderName)].filter(Boolean).join('/')
    : folderPath ?? '';

  const folderOptions = (folderTree ? flattenFolders(folderTree) : []).map((f) => ({ path: f.path, label: f.path || '(Device root)' }));
  if (!folderOptions.some((o) => o.path === parent)) folderOptions.unshift({ path: parent, label: `${parent} (new folder)` });

  function changeFields(next: { album?: string; artist?: string }) {
    const nextAlbum = next.album ?? album;
    const nextArtist = next.artist ?? artist;
    if (next.album !== undefined) setAlbum(next.album);
    if (next.artist !== undefined) setArtist(next.artist);
    if (!folderEdited) setFolderName(suggestFolderName(nextArtist, nextAlbum));
  }

  async function search() {
    setBusy('searching');
    setLookupError(null);
    setRelease(null);
    setCandidates(null);
    try {
      const ranked = rankReleases(await searchReleases({ album, artist }), included.length, album);
      setCandidates(ranked.slice(0, 8));
      if (ranked.length === 0) setLookupError('No matching albums found. Check the spelling of the album and artist.');
    } catch {
      setLookupError('Lookup failed. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  async function choose(candidate: ReleaseCandidate) {
    setBusy('loading');
    setLookupError(null);
    try {
      const details = await getRelease(candidate.id);
      const cover = await fetchAlbumArt(details.id, details.releaseGroupId ?? candidate.releaseGroupId);
      const fields = fieldsFromRelease(details);
      setRelease(details);
      setArt(cover);
      setCandidates(null);
      setAlbum(fields.album);
      setArtist(fields.artist);
      setYear(fields.year);
      if (!folderEdited) setFolderName(suggestFolderName(fields.artist, fields.album));

      if (mode === 'create') {
        // Also pull in loose songs on the device that clearly belong to this album.
        const allTracks = trackOrder.map((id) => tracksById[id]);
        const loose = findLooseTracks(allTracks, Object.keys(config.folderCategories));
        const have = new Set(songs.map((s) => s.id));
        const pool = loose.filter((t) => !have.has(t.id));
        const extra = matchToTracklist(pool, details.tracks, 0.85);
        const found = pool.filter((t) => extra.has(t.id));
        if (found.length > 0) {
          setSongs((prev) => [...prev, ...found]);
          setAddedFromDevice(found.length);
        }
      }
    } catch {
      setLookupError('Could not load that album. Try another one, or try again.');
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    cancelRef.current = false;
    setPhase('working');
    const fields = { album, artist, year };
    const items = included.map((song) => ({
      id: song.id,
      tags: song.canWriteTags ? buildAlbumTags(song, fields, matches.get(song.id) ?? null, art, fillOnly) : null,
      move: mode === 'create',
    }));
    try {
      setResult(await applyAlbumPlan(targetPath, items, {
        onProgress: (done, total, current) => setProgress({ done, total, current }),
        shouldCancel: () => cancelRef.current,
      }));
    } catch (err) {
      setResult({ applied: 0, failed: [{ name: 'Album', reason: err instanceof Error ? err.message : 'Unexpected error' }], cancelled: false });
    }
    setPhase('done');
  }

  function handleClose() {
    if (phase !== 'working') onClose();
  }

  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const title = mode === 'create' ? 'Create album' : 'Fill in album info';
  const actionLabel = mode === 'existing'
    ? `Update ${included.length} ${included.length === 1 ? 'song' : 'songs'}`
    : included.length === 0
      ? 'Create empty album folder'
      : `Create album with ${included.length} ${included.length === 1 ? 'song' : 'songs'}`;

  return (
    <Modal title={title} onClose={handleClose} width={640}>
      {phase === 'edit' && (
        <>
          {distinctAlbums > 1 && (
            <div className="banner banner-warning">
              These songs are tagged with {distinctAlbums} different albums. This works best for songs from one album —
              untick any that don’t belong, and keep “Only fill in what’s missing” on so their existing album tags stay.
            </div>
          )}
          <div className="field-row">
            <label className="field">
              <span>Album</span>
              <input value={album} onChange={(e) => changeFields({ album: e.target.value })} />
            </label>
            <label className="field">
              <span>Artist</span>
              <input value={artist} onChange={(e) => changeFields({ artist: e.target.value })} />
            </label>
            <label className="field field-year">
              <span>Year</span>
              <input value={year} inputMode="numeric" onChange={(e) => setYear(e.target.value)} />
            </label>
          </div>

          {mode === 'create' && (
            <div className="field-row">
              <label className="field">
                <span>Folder name</span>
                <input
                  value={folderName}
                  onChange={(e) => { setFolderName(e.target.value); setFolderEdited(true); }}
                />
              </label>
              <label className="field">
                <span>Create inside</span>
                <select value={parent} onChange={(e) => setParent(e.target.value)}>
                  {folderOptions.map((o) => <option key={o.path || '.'} value={o.path}>{o.label}</option>)}
                </select>
              </label>
            </div>
          )}

          <div className="album-lookup">
            <button type="button" className="btn btn-small" disabled={busy !== null || (!album.trim() && !artist.trim())} onClick={search}>
              {busy === 'searching' ? 'Searching…' : 'Look up album info online'}
            </button>
            <span className="import-hint">Finds the year, track numbers and cover art on MusicBrainz.</span>
          </div>

          {busy === 'loading' && <p className="import-hint">Loading the tracklist and cover art…</p>}
          {lookupError && <div className="banner banner-error">{lookupError}</div>}

          {candidates && candidates.length > 0 && (
            <ul className="picker-list">
              {candidates.map((c) => (
                <li key={c.id}>
                  <button type="button" className="picker-item autotag-result" disabled={busy !== null} onClick={() => choose(c)}>
                    <span className="autotag-result-main"><strong>{c.title}</strong> — {c.artist || 'Unknown artist'}</span>
                    <span className="autotag-result-sub">
                      {[yearFromReleaseDate(c.date), `${c.trackCount} tracks`, c.country, c.status].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {release && (
            <div className="album-release">
              <div className="album-release-art">
                {artUrl ? <img src={artUrl} alt="" /> : <MusicNoteIcon size={28} />}
              </div>
              <div className="album-release-text">
                <strong>{release.title}</strong>
                <span>{release.artist}{release.date ? ` · ${yearFromReleaseDate(release.date)}` : ''}</span>
                <span className="import-hint">
                  {release.tracks.length} tracks · matched {matches.size} of {included.length} {included.length === 1 ? 'song' : 'songs'}
                  {!art && ' · no cover art found'}
                  {addedFromDevice > 0 && ` · added ${addedFromDevice} from the device`}
                </span>
              </div>
            </div>
          )}

          {songs.length > 0 && (
            <ul className="album-songs">
              {songs.map((song) => {
                const matched = matches.get(song.id);
                return (
                  <li key={song.id} className={excluded.has(song.id) ? 'excluded' : ''}>
                    <input
                      type="checkbox"
                      checked={!excluded.has(song.id)}
                      onChange={(e) => setExcluded((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.delete(song.id); else next.add(song.id);
                        return next;
                      })}
                    />
                    <span className="album-song-name" title={song.id}>{song.tags?.title || song.name}</span>
                    <span className="album-song-match">
                      {release
                        ? (matched ? `#${matched.position} ${matched.title}` : 'not on this release')
                        : (albumKeyOf(song) === UNKNOWN_ALBUM_KEY ? 'no album info' : song.tags?.album)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <label className="check-row">
            <input type="checkbox" checked={fillOnly} onChange={(e) => setFillOnly(e.target.checked)} />
            <span>Only fill in what’s missing (keep tags I’ve already set)</span>
          </label>
          {untaggable > 0 && (
            <p className="import-hint">
              {untaggable} {untaggable === 1 ? 'song isn’t an MP3, so its' : 'songs aren’t MP3s, so their'} tags can’t be changed
              {mode === 'create' ? ' — they’ll still be moved into the folder.' : '.'}
            </p>
          )}
          {mode === 'create' && (
            <p className="import-hint">
              {included.length > 0 ? `${included.length} ${included.length === 1 ? 'song' : 'songs'} will be moved to ` : 'A folder will be created at '}
              <strong>{targetPath || '(Device root)'}</strong>.
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy !== null || (mode === 'existing' && included.length === 0) || (mode === 'create' && !folderName.trim())}
              onClick={apply}
            >
              {actionLabel}
            </button>
          </div>
        </>
      )}

      {phase === 'working' && (
        <>
          <p className="import-summary">Working on {Math.min(progress.done + 1, progress.total)} of {progress.total}</p>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
          <p className="import-current">{progress.current || 'Finishing up…'}</p>
          <div className="modal-actions">
            <button type="button" className="btn" disabled={stopping} onClick={() => { cancelRef.current = true; setStopping(true); }}>
              {stopping ? 'Stopping after this song…' : 'Stop'}
            </button>
          </div>
        </>
      )}

      {phase === 'done' && result && (
        <>
          <p className="import-summary">
            {result.applied > 0
              ? <>{mode === 'create' ? 'Created' : 'Updated'} <strong>{result.applied}</strong> {result.applied === 1 ? 'song' : 'songs'}{result.cancelled ? ' before stopping' : ''}.</>
              : included.length === 0 && mode === 'create' && result.failed.length === 0
                ? <>Created the folder <strong>{targetPath}</strong>.</>
                : 'Nothing was changed.'}
          </p>
          {result.failed.length > 0 && (
            <>
              <div className="banner banner-error">{result.failed.length} could not be updated.</div>
              <ul className="import-list">
                {result.failed.map((f, i) => (
                  <li key={`${f.name}-${i}`}><span className="import-file-name">{f.name}</span><span className="import-file-size">{f.reason}</span></li>
                ))}
              </ul>
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </>
      )}
    </Modal>
  );
}
