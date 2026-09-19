import { useLibraryStore } from './store/useLibraryStore';
import { ConnectScreen } from './components/ConnectScreen';
import { Sidebar } from './components/Sidebar';
import { LibraryView } from './components/LibraryView';
import { PlayerBar } from './components/PlayerBar';
import './App.css';

function App() {
  const hasLoadedOnce = useLibraryStore((s) => s.hasLoadedOnce);
  const status = useLibraryStore((s) => s.status);
  const scanProgress = useLibraryStore((s) => s.scanProgress);

  if (!hasLoadedOnce) {
    return <ConnectScreen />;
  }

  return (
    <div className="app-shell">
      {status === 'scanning' && (
        <div className="rescan-banner">Rescanning device… ({scanProgress} files found)</div>
      )}
      <div className="app-body">
        <Sidebar />
        <main className="app-main">
          <LibraryView />
        </main>
      </div>
      <PlayerBar />
    </div>
  );
}

export default App;
