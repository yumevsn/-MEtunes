import { useMemo, useRef, useState } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import type { TrackEntry } from '../types';
import {
  albumKeyOf, buildAlbumTags, clusterByArtist, findLooseTracks, groupByAlbum, matchToTracklist, rankReleases,
  sectionFolderFor, similarity, suggestFolderName, UNKNOWN_ALBUM_KEY, type AlbumGroup,
} from '../lib/albums';
import { fetchAlbumArt, type FetchedArt } from '../lib/coverArt';
import { getRelease, searchReleases, yearFromReleaseDate, type ReleaseDetails } from '../lib/musicbrainz';
import { Modal } from './Modal';

interface FindAlbumsModalProps {
  onOpenAlbum: (tracks: TrackEntry[], seed: { album?: string; artist?: string }) => void;
  onClose: () => void;
}

export function FindAlbumsModal({ onOpenAlbum, onClose }: FindAlbumsModalProps) {
  const tracksById = useLibraryStore((s) => s.tracksById);
  const trackOrder = useLibraryStore((s) => s.trackOrder);
  const config = useLibraryStore((s) => s.config);
  const folderTree = useLibraryStore((s) => s.folderTree);
  const applyAlbumPlan = useLibraryStore((s) => s.applyAlbumPlan);
  const rescan = useLibraryStore((s) => s.rescan);

  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [lookup, setLookup] = useState(true);
  const [phase, setPhase] = useState<'review' | 'working' | 'done'>('review');
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' });
  const [stopping, setStopping] = useState(false);
  const [summary, setSummary] = useState({ albums: 0, songs: 0, failed: 0, enriched: 0 });
  const cancelRef = useRef(false);

  const scan = useMemo(() => {
    const all = trackOrder.map((id) => tracksById[id]);
    const loose = findLooseTracks(all, Object.keys(config.folderCategories));
    const tagged = loose.filter((t) => albumKeyOf(t) !== UNKNOWN_ALBUM_KEY);
    const groups = groupByAlbum(tagged);
    return {
      loose,
      groups: groups.filter((g) => g.tracks.length >= 2),
      singles: groups.filter((g) => g.tracks.length < 2).length,
      unidentified: clusterByArtist(loose.filter((t) => albumKeyOf(t) === UNKNOWN_ALBUM_KEY)),
      stillReading: loose.filter((t) => !t.tagsLoaded).length,
    };
  }, [tracksById, trackOrder, config]);

  const chosen = scan.groups.filter((g) => !skipped.has(g.key));
  const chosenSongs = chosen.reduce((sum, g) => sum + g.tracks.length, 0);

  function parentFor(group: AlbumGroup): string {
    const dirs = new Set(group.tracks.map((t) => t.dirPath));
    const only = dirs.size === 1 ? [...dirs][0] : '';
    return only && !only.includes('/') ? only : sectionFolderFor(folderTree, 'music');
  }

  async function run() {
    cancelRef.current = false;
    setPhase('working');
    let songs = 0;
    let failed = 0;
    let enriched = 0;
    let albums = 0;
    for (const [index, group] of chosen.entries()) {
      if (cancelRef.current) break;
      setProgress({ done: index, total: chosen.length, current: group.album });
      let release: ReleaseDetails | null = null;
      let art: FetchedArt | null = null;
      if (lookup) {
        try {
          const best = rankReleases(await searchReleases({ album: group.album, artist: group.artist }), group.tracks.length, group.album)[0];
          if (best && best.score >= 90 && similarity(best.title, group.album) >= 0.8) {
            release = await getRelease(best.id);
            art = await fetchAlbumArt(release.id, release.releaseGroupId ?? best.releaseGroupId);
          }
        } catch {
          // Offline or rate-limited: still group the songs, just without the extra info.
        }
      }
      if (release) enriched += 1;
      const fields = {
        album: group.album,
        artist: group.artist,
        year: group.year || (release ? yearFromReleaseDate(release.date) : ''),
      };
      const matches = release ? matchToTracklist(group.tracks, release.tracks) : new Map();
      const outcome = await applyAlbumPlan(
        [parentFor(group), suggestFolderName(group.artist, group.album)].filter(Boolean).join('/'),
        group.tracks.map((song) => ({
          id: song.id,
          tags: song.canWriteTags ? buildAlbumTags(song, fields, matches.get(song.id) ?? null, art, true) : null,
          move: true,
        })),
        { rescan: false, shouldCancel: () => cancelRef.current },
      );
      songs += outcome.applied;
      failed += outcome.failed.length;
      if (outcome.applied > 0) albums += 1;
    }
    setProgress((p) => ({ ...p, done: p.total, current: '' }));
    if (songs > 0) await rescan();
    setSummary({ albums, songs, failed, enriched });
    setPhase('done');
  }

  function handleClose() {
    if (phase !== 'working') onClose();
  }

  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const nothingFound = scan.groups.length === 0 && scan.unidentified.length === 0;

  return (
    <Modal title="Find albums" onClose={handleClose} width={620}>
      {phase === 'review' && (
        <>
          <p className="import-hint find-intro">
            Looks for songs that aren’t inside an album folder — loose in the device root or in a catch-all folder like
            Music — and suggests grouping them by the album in their tags.
          </p>
          {scan.stillReading > 0 && (
            <div className="banner banner-warning">Still reading tags from {scan.stillReading} songs — results will fill in as it goes.</div>
          )}

          {nothingFound && scan.stillReading === 0 && (
            <p className="import-summary">
              {scan.loose.length === 0
                ? 'Every song is already inside a folder. Nothing to organize.'
                : `No albums found among the ${scan.loose.length} loose songs.`}
            </p>
          )}

          {scan.groups.length > 0 && (
            <>
              <div className="find-heading">Albums found ({scan.groups.length})</div>
              <ul className="find-list">
                {scan.groups.map((group) => (
                  <li key={group.key}>
                    <label className="find-row">
                      <input
                        type="checkbox"
                        checked={!skipped.has(group.key)}
                        onChange={(e) => setSkipped((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.delete(group.key); else next.add(group.key);
                          return next;
                        })}
                      />
                      <span className="find-row-main">
                        <strong>{group.album}</strong>
                        <span className="find-row-sub">{group.artist || 'Unknown artist'} · {group.tracks.length} songs</span>
                        <span className="find-row-sub">→ {parentFor(group)}/{suggestFolderName(group.artist, group.album)}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {scan.singles > 0 && (
                <p className="import-hint">{scan.singles} more {scan.singles === 1 ? 'song is' : 'songs are'} the only one from {scan.singles === 1 ? 'its album' : 'their albums'}, so {scan.singles === 1 ? 'it was' : 'they were'} left alone.</p>
              )}
            </>
          )}

          {scan.unidentified.length > 0 && (
            <>
              <div className="find-heading">Songs with no album info</div>
              <ul className="find-list">
                {scan.unidentified.map((cluster) => (
                  <li key={cluster.key || 'unknown'} className="find-row">
                    <span className="find-row-main">
                      <strong>{cluster.artist || 'Unknown artist'}</strong>
                      <span className="find-row-sub">{cluster.tracks.length} {cluster.tracks.length === 1 ? 'song' : 'songs'}</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => onOpenAlbum(cluster.tracks, { artist: cluster.artist })}
                    >
                      Identify album…
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {scan.groups.length > 0 && (
            <label className="check-row">
              <input type="checkbox" checked={lookup} onChange={(e) => setLookup(e.target.checked)} />
              <span>Also look up year, track numbers and cover art online (takes a few seconds per album)</span>
            </label>
          )}

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Close</button>
            {scan.groups.length > 0 && (
              <button type="button" className="btn btn-primary" disabled={chosen.length === 0} onClick={run}>
                Create {chosen.length} {chosen.length === 1 ? 'album' : 'albums'} ({chosenSongs} songs)
              </button>
            )}
          </div>
        </>
      )}

      {phase === 'working' && (
        <>
          <p className="import-summary">Creating album {Math.min(progress.done + 1, progress.total)} of {progress.total}</p>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
          <p className="import-current">{progress.current || 'Finishing up…'}</p>
          <div className="modal-actions">
            <button type="button" className="btn" disabled={stopping} onClick={() => { cancelRef.current = true; setStopping(true); }}>
              {stopping ? 'Stopping after this album…' : 'Stop'}
            </button>
          </div>
        </>
      )}

      {phase === 'done' && (
        <>
          <p className="import-summary">
            {summary.songs > 0
              ? <>Created <strong>{summary.albums}</strong> {summary.albums === 1 ? 'album' : 'albums'} from <strong>{summary.songs}</strong> songs.</>
              : 'Nothing was changed.'}
            {summary.enriched > 0 && <span className="import-skipped"> Added online info to {summary.enriched}.</span>}
          </p>
          {summary.failed > 0 && <div className="banner banner-error">{summary.failed} songs could not be moved.</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </>
      )}
    </Modal>
  );
}
