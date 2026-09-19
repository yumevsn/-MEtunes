import { isFileSystemAccessSupported } from '../lib/fsAccess';
import { isWebUsbSupported } from '../lib/usbIdentify';
import { useLibraryStore } from '../store/useLibraryStore';

export function ConnectScreen() {
  const status = useLibraryStore((s) => s.status);
  const connect = useLibraryStore((s) => s.connect);
  const connectDemo = useLibraryStore((s) => s.connectDemo);
  const errorMessage = useLibraryStore((s) => s.errorMessage);
  const scanProgress = useLibraryStore((s) => s.scanProgress);
  const supported = isFileSystemAccessSupported();
  const usbSupported = isWebUsbSupported();
  const busy = status === 'connecting' || status === 'scanning';

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div className="connect-logo">🎵</div>
        <h1>MEtunes</h1>
        <p className="connect-tagline">
          Plug in a phone or memory card reader, then connect its storage below to browse, tag, and organize
          music, audiobooks, and video-as-audio files — right from your browser, nothing is uploaded anywhere.
        </p>

        {!supported && (
          <div className="banner banner-error">
            This browser doesn't support the File System Access API. Please use a recent version of Chrome
            or Edge on desktop.
          </div>
        )}
        {supported && !usbSupported && (
          <div className="banner banner-warning">
            WebUSB isn't available here, so exact device identification will be skipped — file browsing and
            tag editing will still work normally.
          </div>
        )}
        {errorMessage && <div className="banner banner-error">{errorMessage}</div>}

        <button
          type="button"
          className="btn btn-primary btn-large"
          disabled={!supported || busy}
          onClick={() => connect()}
        >
          {status === 'connecting' && 'Waiting for folder selection…'}
          {status === 'scanning' && `Scanning device… (${scanProgress} files found)`}
          {(status === 'idle' || status === 'error') && 'Connect device storage'}
        </button>

        <ol className="connect-steps">
          <li>Connect your phone with a USB cable and switch it to “USB storage” / “Mass storage” mode.</li>
          <li>Click “Connect device storage” above and pick the phone's drive (or its memory card) from the dialog.</li>
          <li>Optionally identify the exact device afterwards from the sidebar.</li>
        </ol>

        <div className="connect-divider"><span>or</span></div>

        <button type="button" className="btn btn-demo" disabled={busy} onClick={() => connectDemo()}>
          🧪 Try Demo Mode (no device needed)
        </button>
        <p className="connect-demo-note">
          Loads a small made-up library so you can try browsing, tagging, playlists and auto-tag without any
          hardware. Playback is simulated — there's no real audio behind the demo tracks.
        </p>
      </div>
    </div>
  );
}
