
import React from 'react';
import { ChatBubbleIcon } from './Icons';

interface AskMarkieButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

const AskMarkieButton: React.FC<AskMarkieButtonProps> = ({ onClick, disabled }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-slate-50 transition-colors duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed"
      aria-label="Ask Markie for help"
    >
      <ChatBubbleIcon className="w-4 h-4 mr-2" />
      Ask Markie
    </button>
  );
};

export default AskMarkieButton;