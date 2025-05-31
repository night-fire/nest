
import React, { useState, useEffect, useRef } from 'react';
import { FileSystemNodeType } from '../types';
import { DocumentPlusIcon, FolderPlusIcon, XCircleIcon } from './Icons';

interface NameInputModalProps {
  isOpen: boolean;
  nodeType: FileSystemNodeType | null;
  title: string;
  promptText: string;
  confirmText?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

const NameInputModal: React.FC<NameInputModalProps> = ({
  isOpen,
  nodeType,
  title,
  promptText,
  confirmText = "Create",
  onConfirm,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(''); // Reset name on open
      setTimeout(() => inputRef.current?.focus(), 100); // Focus after transition
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
    }
  };

  const Icon = nodeType === FileSystemNodeType.FILE ? DocumentPlusIcon : FolderPlusIcon;

  return (
    <div
      className={`
        fixed inset-0 flex items-center justify-center z-[100] p-4
        transition-opacity duration-300 ease-out
        ${isOpen ? 'opacity-100 bg-slate-900/40 backdrop-blur-sm' : 'opacity-0 bg-transparent pointer-events-none backdrop-filter-none'}
      `}
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-input-modal-title"
      aria-hidden={!isOpen}
      onClick={isOpen ? onCancel : undefined}
    >
      <div
        className={`
          bg-white p-5 md:p-6 rounded-lg shadow-xl max-w-md w-full border border-slate-300
          transform transition-all duration-300 ease-out
          ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-5 pointer-events-none'}
        `}
        onClick={(e) => { if (isOpen) e.stopPropagation(); }}
      >
        <div className="flex items-center mb-4">
          {nodeType && <Icon className={`w-6 h-6 mr-3 ${nodeType === FileSystemNodeType.FILE ? 'text-sky-600' : 'text-amber-600'}`} />}
          <h3 id="name-input-modal-title" className="text-lg font-display font-semibold text-slate-800">{title}</h3>
        </div>
        
        <form onSubmit={handleSubmit}>
          <label htmlFor="nodeNameInput" className="block text-sm font-medium text-slate-600 mb-1.5">
            {promptText}
          </label>
          <input
            ref={inputRef}
            type="text"
            id="nodeNameInput"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400"
            placeholder={nodeType === FileSystemNodeType.FILE ? "e.g., my-notes.md" : "e.g., Project Alpha"}
            disabled={!isOpen}
            required
          />
          <p className="text-xs text-slate-500 mt-1.5">Press Enter to confirm or Escape to cancel.</p>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sky-500 transition-colors"
              aria-label="Cancel creation"
              disabled={!isOpen}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors ${
                nodeType === FileSystemNodeType.FILE ? 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500' : 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
              } disabled:opacity-50`}
              aria-label={confirmText}
              disabled={!isOpen || !name.trim()}
            >
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NameInputModal;
