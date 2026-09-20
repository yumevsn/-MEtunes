import { useEffect, useState } from 'react';
import { useLibraryStore } from './store/useLibraryStore';
import { ConnectScreen } from './components/ConnectScreen';
import { Sidebar } from './components/Sidebar';
import { LibraryView } from './components/LibraryView';
import { PlayerBar } from './components/PlayerBar';
import { ImportModal } from './components/ImportModal';
import { collectDroppedItems } from './lib/importFiles';
import './App.css';
import './views.css';

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

function canImportNow(): boolean {
  const { hasLoadedOnce, pendingImport, status } = useLibraryStore.getState();
  return hasLoadedOnce && pendingImport === null && status !== 'scanning';
}

function App() {
  const hasLoadedOnce = useLibraryStore((s) => s.hasLoadedOnce);
  const status = useLibraryStore((s) => s.status);
  const scanProgress = useLibraryStore((s) => s.scanProgress);
  const pendingImport = useLibraryStore((s) => s.pendingImport);
  const setPendingImport = useLibraryStore((s) => s.setPendingImport);
  const sidebarOpen = useLibraryStore((s) => s.sidebarOpen);
  const setSidebarOpen = useLibraryStore((s) => s.setSidebarOpen);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    // Counts nested enter/leave events so the overlay doesn't flicker over child elements.
    let depth = 0;

    function onDragEnter(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      if (canImportNow()) setDragging(true);
    }

    function onDragOver(e: DragEvent) {
      if (!hasFiles(e)) return;
      // Cancelling dragover is what makes the drop legal; without it the browser opens the file instead.
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = canImportNow() ? 'copy' : 'none';
    }

    function onDragLeave(e: DragEvent) {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    }

    async function onDrop(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (!e.dataTransfer || !canImportNow()) return;
      const items = await collectDroppedItems(e.dataTransfer);
      if (items.length > 0) setPendingImport(items);
    }

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [setPendingImport]);

  if (!hasLoadedOnce) {
    return <ConnectScreen />;
  }

  return (
    <div className="app-shell">
      {status === 'scanning' && (
        <div className="rescan-banner">Rescanning device… ({scanProgress} files found)</div>
      )}
      <div className="app-body">
        <div className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
        <Sidebar />
        <main className="app-main">
          <LibraryView />
        </main>
      </div>
      <PlayerBar />

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-card">
            <div className="drop-overlay-title">Drop to import</div>
            <div className="drop-overlay-sub">Songs, audiobooks, videos — or whole folders — will be copied to the device</div>
          </div>
        </div>
      )}

      {pendingImport && <ImportModal items={pendingImport} onClose={() => setPendingImport(null)} />}
    </div>
  );
}

export default App;
