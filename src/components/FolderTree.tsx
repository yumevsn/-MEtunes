import { useState } from 'react';
import type { FolderNode, MediaCategory } from '../types';
import { CATEGORY_LABELS } from '../types';
import { useLibraryStore } from '../store/useLibraryStore';
import { ChevronDownIcon, ChevronRightIcon, FolderIcon } from './icons';

const CATEGORIES: MediaCategory[] = ['music', 'audiobooks', 'videos'];

interface FolderTreeProps {
  node: FolderNode;
  depth: number;
  categoryFor: (topFolder: string) => MediaCategory | null;
  onSetCategory: (topFolder: string, category: MediaCategory) => void;
}

export function FolderTree({ node, depth, categoryFor, onSetCategory }: FolderTreeProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const selectedView = useLibraryStore((s) => s.selectedView);
  const setSelectedView = useLibraryStore((s) => s.setSelectedView);

  const hasChildren = node.children.length > 0;
  const isActive = selectedView.type === 'folder' && selectedView.path === node.path;
  const isTopLevel = node.path !== '' && !node.path.includes('/');
  const category = isTopLevel ? categoryFor(node.path) : null;

  return (
    <div>
      <div className="folder-tree-row" style={{ paddingLeft: 8 + depth * 14 }}>
        {hasChildren ? (
          <button
            type="button"
            className="tree-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDownIcon size={11} /> : <ChevronRightIcon size={11} />}
          </button>
        ) : (
          <span className="tree-toggle-spacer" />
        )}
        <button
          type="button"
          className={`sidebar-item-main tree-name ${isActive ? 'active' : ''}`}
          onClick={() => setSelectedView({ type: 'folder', path: node.path })}
          title={node.path || 'Device root'}
        >
          <span className="sidebar-icon"><FolderIcon size={15} /></span>
          <span className="sidebar-label">{node.path === '' ? 'Device root' : node.name}</span>
        </button>
        {isTopLevel && category && (
          <select
            className="folder-tree-category"
            value={category}
            onChange={(e) => onSetCategory(node.path, e.target.value as MediaCategory)}
            title="Library section"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        )}
      </div>
      {expanded && node.children.map((child) => (
        <FolderTree key={child.path} node={child} depth={depth + 1} categoryFor={categoryFor} onSetCategory={onSetCategory} />
      ))}
    </div>
  );
}
