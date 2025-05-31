
import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  checkboxLabel?: string;
  isCheckboxChecked?: boolean;
  onCheckboxChange?: (isChecked: boolean) => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "bg-red-600 hover:bg-red-700 focus:ring-red-500",
  checkboxLabel,
  isCheckboxChecked,
  onCheckboxChange,
}) => {
  return (
    <div 
      className={`
        fixed inset-0 flex items-center justify-center z-[100] p-4
        transition-opacity duration-300 ease-out
        ${isOpen ? 'opacity-100 bg-slate-900/40 backdrop-blur-sm' : 'opacity-0 bg-transparent pointer-events-none backdrop-filter-none'}
      `}
      role="alertdialog" 
      aria-modal="true" 
      aria-labelledby="confirmation-modal-title"
      aria-describedby={checkboxLabel ? "confirmation-modal-checkbox-description" : "confirmation-modal-message"}
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
        <h3 id="confirmation-modal-title" className="text-lg font-display font-semibold text-slate-800 mb-3">{title}</h3>
        <p id="confirmation-modal-message" className="text-sm text-slate-600 mb-5 whitespace-pre-wrap">{message}</p>
        
        {checkboxLabel && onCheckboxChange && (
          <div className="mb-5">
            <label htmlFor="confirmation-checkbox" className="flex items-center text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                id="confirmation-checkbox"
                className="h-4 w-4 text-sky-600 border-slate-400 rounded focus:ring-sky-500 mr-2.5 cursor-pointer"
                checked={isCheckboxChecked}
                onChange={(e) => onCheckboxChange(e.target.checked)}
                aria-describedby="confirmation-modal-checkbox-description"
                disabled={!isOpen}
              />
              <span id="confirmation-modal-checkbox-description">{checkboxLabel}</span>
            </label>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sky-500 transition-colors"
            aria-label={cancelText}
            disabled={!isOpen}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors ${confirmButtonClass}`}
            aria-label={confirmText}
            disabled={!isOpen}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;