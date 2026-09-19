import type { FolderNode } from '../types';
import { flattenFolders } from '../lib/fsAccess';
import { Modal } from './Modal';

interface FolderPickerModalProps {
  folderTree: FolderNode;
  onPick: (path: string) => void;
  onClose: () => void;
}

export function FolderPickerModal({ folderTree, onPick, onClose }: FolderPickerModalProps) {
  const folders = flattenFolders(folderTree);

  return (
    <Modal title="Move to folder" onClose={onClose}>
      <ul className="picker-list">
        {folders.map((folder) => (
          <li key={folder.path || '.'}>
            <button
              type="button"
              className="picker-item"
              onClick={() => {
                onPick(folder.path);
                onClose();
              }}
            >
              {folder.path ? folder.path : '(Device root)'}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
