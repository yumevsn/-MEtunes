import { useState } from 'react';
import { Modal } from './Modal';

interface InputModalProps {
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

export function InputModal({ title, label, initialValue = '', confirmLabel = 'Create', onConfirm, onClose }: InputModalProps) {
  const [value, setValue] = useState(initialValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onConfirm(value.trim());
    onClose();
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>{label}</span>
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!value.trim()}>{confirmLabel}</button>
        </div>
      </form>
    </Modal>
  );
}
