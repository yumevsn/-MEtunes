import { useState } from 'react';
import type { TrackEntry, TrackTags } from '../types';
import { pictureToObjectUrl } from '../lib/metadata';
import { Modal } from './Modal';
import { MusicNoteIcon } from './icons';

interface TagEditorModalProps {
  track: TrackEntry;
  onSave: (tags: TrackTags) => Promise<void>;
  onClose: () => void;
}

const EMPTY_TAGS: TrackTags = {
  title: '', artist: '', album: '', albumArtist: '', track: '', year: '', genre: '', picture: null,
};

export function TagEditorModal({ track, onSave, onClose }: TagEditorModalProps) {
  const [tags, setTags] = useState<TrackTags>(track.tags ?? { ...EMPTY_TAGS, title: track.name });
  const [saving, setSaving] = useState(false);
  const artUrl = pictureToObjectUrl(tags.picture);

  function updateField<K extends keyof TrackTags>(key: K, value: TrackTags[K]) {
    setTags((prev) => ({ ...prev, [key]: value }));
  }

  async function handleArtChange(file: File | undefined) {
    if (!file) return;
    const buffer = new Uint8Array(await file.arrayBuffer());
    updateField('picture', { format: file.type || 'image/jpeg', data: buffer });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(tags);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit tags — ${track.name}`} onClose={onClose} width={480}>
      {!track.canWriteTags && (
        <p className="modal-note">
          This is a {track.ext.toUpperCase()} file. MEtunes can only write tags back to MP3 files right now —
          you can still preview the existing metadata below.
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <div className="tag-form-grid">
          <div className="art-picker">
            <div className="art-preview">
              {artUrl ? <img src={artUrl} alt="Album art" /> : <div className="art-placeholder"><MusicNoteIcon size={28} /></div>}
            </div>
            <label className="btn btn-small">
              Change art
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={!track.canWriteTags}
                onChange={(e) => handleArtChange(e.target.files?.[0])}
              />
            </label>
          </div>
          <div className="tag-fields">
            <label className="field">
              <span>Title</span>
              <input value={tags.title} disabled={!track.canWriteTags} onChange={(e) => updateField('title', e.target.value)} />
            </label>
            <label className="field">
              <span>Artist</span>
              <input value={tags.artist} disabled={!track.canWriteTags} onChange={(e) => updateField('artist', e.target.value)} />
            </label>
            <label className="field">
              <span>Album</span>
              <input value={tags.album} disabled={!track.canWriteTags} onChange={(e) => updateField('album', e.target.value)} />
            </label>
            <label className="field">
              <span>Album artist</span>
              <input value={tags.albumArtist} disabled={!track.canWriteTags} onChange={(e) => updateField('albumArtist', e.target.value)} />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Track #</span>
                <input value={tags.track} disabled={!track.canWriteTags} onChange={(e) => updateField('track', e.target.value)} />
              </label>
              <label className="field">
                <span>Year</span>
                <input value={tags.year} disabled={!track.canWriteTags} onChange={(e) => updateField('year', e.target.value)} />
              </label>
            </div>
            <label className="field">
              <span>Genre</span>
              <input value={tags.genre} disabled={!track.canWriteTags} onChange={(e) => updateField('genre', e.target.value)} />
            </label>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!track.canWriteTags || saving}>
            {saving ? 'Saving…' : 'Save tags'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
