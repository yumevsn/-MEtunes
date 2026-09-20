import { useRef, useState } from 'react';
import { useLibraryStore, type ViewSelection } from '../store/useLibraryStore';
import type { FolderNode, ImportItem, ImportResult, MediaCategory } from '../types';
import { flattenFolders } from '../lib/fsAccess';
import { formatBytes, mediaKindOf } from '../lib/format';
import { isImportable } from '../lib/importFiles';
import { Modal } from './Modal';

const DEFAULT_FOLDER: Record<MediaCategory, string> = {
  music: 'Music',
  audiobooks: 'Audiobooks',
  videos: 'Videos',
};

const PREVIEW_LIMIT = 50;

function suggestDestination(view: ViewSelection, folderTree: FolderNode | null, items: ImportItem[]): string {
  if (view.type === 'folder') return view.path;
  let category: MediaCategory;
  if (view.type === 'category') {
    category = view.category;
  } else {
    const allVideo = items.length > 0 && items.every((item) => mediaKindOf(item.file.name) === 'video');
    category = allVideo ? 'videos' : 'music';
  }
  const wanted = DEFAULT_FOLDER[category];
  const existing = folderTree?.children.find((child) => child.name.toLowerCase() === wanted.toLowerCase());
  return existing ? existing.path : wanted;
}

interface ImportModalProps {
  items: ImportItem[];
  onClose: () => void;
}

export function ImportModal({ items, onClose }: ImportModalProps) {
  const selectedView = useLibraryStore((s) => s.selectedView);
  const folderTree = useLibraryStore((s) => s.folderTree);
  const importItems = useLibraryStore((s) => s.importItems);

  const importable = items.filter(isImportable);
  const skipped = items.length - importable.length;
  const totalBytes = importable.reduce((sum, item) => sum + item.file.size, 0);
  const keepsFolders = importable.some((item) => item.relativePath.includes('/'));

  const [suggested] = useState(() => suggestDestination(selectedView, folderTree, importable));
  const [dest, setDest] = useState(suggested);
  const [phase, setPhase] = useState<'review' | 'importing' | 'done'>('review');
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' });
  const [stopping, setStopping] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const cancelRef = useRef(false);

  const folderOptions = (folderTree ? flattenFolders(folderTree) : []).map((folder) => ({
    path: folder.path,
    label: folder.path || '(Device root)',
  }));
  if (!folderOptions.some((option) => option.path === suggested)) {
    folderOptions.unshift({ path: suggested, label: `${suggested} (new folder)` });
  }

  async function start() {
    cancelRef.current = false;
    setPhase('importing');
    try {
      const outcome = await importItems(
        importable,
        dest,
        (done, total, current) => setProgress({ done, total, current }),
        () => cancelRef.current,
      );
      setResult(outcome);
    } catch (err) {
      setResult({
        imported: 0,
        failed: [{ name: 'Import', reason: err instanceof Error ? err.message : 'Unexpected error' }],
        cancelled: false,
      });
    }
    setPhase('done');
  }

  function handleClose() {
    if (phase !== 'importing') onClose();
  }

  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Modal title="Import to device" onClose={handleClose} width={500}>
      {phase === 'review' && importable.length === 0 && (
        <>
          <p className="modal-note">
            None of these {items.length === 1 ? 'files is' : 'files are'} audio or video files MEtunes can
            import (MP3, M4A, AAC, WAV, FLAC, OGG, WMA, AMR, MP4, 3GP and similar).
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        </>
      )}

      {phase === 'review' && importable.length > 0 && (
        <>
          <p className="import-summary">
            <strong>{importable.length}</strong> {importable.length === 1 ? 'file' : 'files'} ·{' '}
            {formatBytes(totalBytes)}
            {skipped > 0 && <span className="import-skipped"> · {skipped} other {skipped === 1 ? 'file' : 'files'} skipped</span>}
          </p>

          <label className="field">
            <span>Copy into</span>
            <select value={dest} onChange={(e) => setDest(e.target.value)}>
              {folderOptions.map((option) => (
                <option key={option.path || '.'} value={option.path}>{option.label}</option>
              ))}
            </select>
          </label>
          {keepsFolders && <p className="import-hint">Folders you added keep their structure inside the destination.</p>}

          <ul className="import-list">
            {importable.slice(0, PREVIEW_LIMIT).map((item, index) => (
              <li key={`${item.relativePath}-${index}`}>
                <span className="import-file-name" title={item.relativePath}>{item.relativePath}</span>
                <span className="import-file-size">{formatBytes(item.file.size)}</span>
              </li>
            ))}
            {importable.length > PREVIEW_LIMIT && (
              <li className="import-more">…and {importable.length - PREVIEW_LIMIT} more</li>
            )}
          </ul>
          <p className="import-hint">Files with the same name are kept — the new one gets “(2)” added.</p>

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={start}>
              Import {importable.length} {importable.length === 1 ? 'file' : 'files'}
            </button>
          </div>
        </>
      )}

      {phase === 'importing' && (
        <>
          <p className="import-summary">
            Copying {Math.min(progress.done + 1, progress.total)} of {progress.total}
          </p>
          <div className="progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <p className="import-current" title={progress.current}>{progress.current || 'Finishing up…'}</p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn"
              disabled={stopping}
              onClick={() => {
                cancelRef.current = true;
                setStopping(true);
              }}
            >
              {stopping ? 'Stopping after this file…' : 'Stop'}
            </button>
          </div>
        </>
      )}

      {phase === 'done' && result && (
        <>
          <p className="import-summary">
            {result.imported > 0
              ? <>Imported <strong>{result.imported}</strong> {result.imported === 1 ? 'file' : 'files'}{result.cancelled ? ' before stopping' : ''}.</>
              : (result.cancelled ? 'Stopped before anything was imported.' : 'Nothing was imported.')}
          </p>
          {result.failed.length > 0 && (
            <>
              <div className="banner banner-error">
                {result.failed.length} {result.failed.length === 1 ? 'file' : 'files'} couldn’t be copied
                (the memory card may be full or write-protected).
              </div>
              <ul className="import-list">
                {result.failed.slice(0, PREVIEW_LIMIT).map((failure, index) => (
                  <li key={`${failure.name}-${index}`}>
                    <span className="import-file-name" title={failure.name}>{failure.name}</span>
                    <span className="import-file-size">{failure.reason}</span>
                  </li>
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
