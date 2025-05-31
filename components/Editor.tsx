
import React, { useRef } from 'react';

interface EditorProps {
  text: string;
  onTextChange: (newText: string) => void;
  isEditMode: boolean;
}

const Editor: React.FC<EditorProps> = ({ text, onTextChange, isEditMode }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onTextChange(event.target.value);
  };

  return (
    <div className="w-full h-full flex flex-col flex-grow relative">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        className="w-full flex-grow p-4 bg-white border border-slate-300 rounded-lg text-slate-800 text-base leading-relaxed focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none resize-none scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-slate-200 shadow-sm"
        placeholder="Start typing your Markdown here..."
        spellCheck="false"
        aria-label="Markdown editor"
        readOnly={!isEditMode}
      />
    </div>
  );
};

export default Editor;