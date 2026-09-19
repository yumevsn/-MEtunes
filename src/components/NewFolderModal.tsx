import { useState } from 'react';
import type { FolderNode } from '../types';
import { flattenFolders } from '../lib/fsAccess';
import { Modal } from './Modal';

interface NewFolderModalProps {
  folderTree: FolderNode;
  defaultParentPath?: string;
  onCreate: (parentPath: string, name: string) => void;
  onClose: () => void;
}

export function NewFolderModal({ folderTree, defaultParentPath = '', onCreate, onClose }: NewFolderModalProps) {
  const folders = flattenFolders(folderTree);
  const [parentPath, setParentPath] = useState(defaultParentPath);
  const [name, setName] = useState('');

  return (
    <Modal title="New folder" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onCreate(parentPath, name.trim());
          onClose();
        }}
      >
        <label className="field">
          <span>Inside</span>
          <select value={parentPath} onChange={(e) => setParentPath(e.target.value)}>
            {folders.map((folder) => (
              <option key={folder.path || '.'} value={folder.path}>
                {folder.path ? folder.path : '(Device root)'}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Folder name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Create</button>
        </div>
      </form>
    </Modal>
  );
}
