import { useState } from 'react';
import type { PlaylistEntry } from '../types';
import { Modal } from './Modal';

interface PlaylistPickerModalProps {
  playlists: PlaylistEntry[];
  onPick: (fileName: string) => void;
  onCreateNew: (name: string) => void;
  onClose: () => void;
}

export function PlaylistPickerModal({ playlists, onPick, onCreateNew, onClose }: PlaylistPickerModalProps) {
  const [newName, setNewName] = useState('');

  return (
    <Modal title="Add to playlist" onClose={onClose}>
      {playlists.length > 0 && (
        <ul className="picker-list">
          {playlists.map((playlist) => (
            <li key={playlist.fileName}>
              <button
                type="button"
                className="picker-item"
                onClick={() => {
                  onPick(playlist.fileName);
                  onClose();
                }}
              >
                {playlist.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="picker-divider">Or create a new playlist</div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          onCreateNew(newName.trim());
          onClose();
        }}
      >
        <div className="field-row">
          <input
            placeholder="New playlist name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={!newName.trim()}>Create</button>
        </div>
      </form>
    </Modal>
  );
}
