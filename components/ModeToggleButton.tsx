
import React from 'react';
import { EditorMode } from '../types';
import { EyeIcon, PencilIcon } from './Icons'; 

interface ModeToggleButtonProps {
  currentMode: EditorMode;
  onToggle: () => void;
  disabled?: boolean;
}

const ModeToggleButton: React.FC<ModeToggleButtonProps> = ({ currentMode, onToggle, disabled }) => {
  const isEditing = currentMode === EditorMode.EDIT;
  const buttonText = isEditing ? 'View Mode' : 'Edit Mode';
  const Icon = isEditing ? EyeIcon : PencilIcon;

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className="flex items-center px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-slate-50 transition-colors duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed"
      aria-label={`Switch to ${buttonText}`}
    >
      <Icon className="w-4 h-4 mr-2" />
      {buttonText}
    </button>
  );
};

export default ModeToggleButton;