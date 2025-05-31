
import React, { useMemo } from 'react';
import { XCircleIcon } from './Icons';

interface DiffSegment {
  type: 'added' | 'removed' | 'common';
  text: string;
  originalLineNumber?: number;
  newLineNumber?: number;
}

// Basic LCS-based diff generation
function generateDiff(originalText: string, newText: string): DiffSegment[] {
  const originalLines = originalText.split('\n');
  const newLines = newText.split('\n');
  const diff: DiffSegment[] = [];

  const dp = Array(originalLines.length + 1)
    .fill(null)
    .map(() => Array(newLines.length + 1).fill(0));

  for (let i = 1; i <= originalLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (originalLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = originalLines.length;
  let j = newLines.length;
  let currentOriginalLineNum = originalLines.length;
  let currentNewLineNum = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === newLines[j - 1]) {
      diff.unshift({ type: 'common', text: originalLines[i - 1], originalLineNumber: currentOriginalLineNum, newLineNumber: currentNewLineNum });
      i--; j--;
      currentOriginalLineNum--; currentNewLineNum--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'added', text: newLines[j - 1], newLineNumber: currentNewLineNum });
      j--;
      currentNewLineNum--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: 'removed', text: originalLines[i - 1], originalLineNumber: currentOriginalLineNum });
      i--;
      currentOriginalLineNum--;
    } else {
      break; // Should not happen in a correct LCS backtrack
    }
  }
  return diff;
}


interface DiffViewerModalProps {
  isOpen: boolean;
  originalContent: string;
  newContent: string;
  onClose: () => void;
}

const DiffViewerModal: React.FC<DiffViewerModalProps> = ({
  isOpen,
  originalContent,
  newContent,
  onClose,
}) => {
  const diffSegments = useMemo(() => {
    if (!isOpen) return []; // Avoid computation if not open
    return generateDiff(originalContent, newContent);
  }, [originalContent, newContent, isOpen]);

  if (!isOpen) {
    return null;
  }
  
  const getLineClass = (type: DiffSegment['type']) => {
    switch (type) {
      case 'added':
        return 'diff-added';
      case 'removed':
        return 'diff-removed';
      default:
        return 'diff-common';
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[150] p-4 transition-opacity duration-300 ease-out bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-viewer-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col border border-slate-300"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-200 flex justify-between items-center shrink-0">
          <h3 id="diff-viewer-modal-title" className="text-lg font-display font-semibold text-slate-800">
            View Document Changes
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-label="Close diff viewer"
          >
            <XCircleIcon className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-grow overflow-auto p-4 md:p-6 bg-slate-50 scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-slate-200">
          {diffSegments.length === 0 && <p className="text-slate-600">No changes detected or content is identical.</p>}
          {diffSegments.map((segment, index) => (
            <div key={index} className={`diff-line ${getLineClass(segment.type)}`}>
              <span className="diff-line-num original-num w-10 shrink-0 pr-2 text-right text-slate-400 select-none">
                {segment.type !== 'added' ? segment.originalLineNumber : ''}
              </span>
              <span className="diff-line-num new-num w-10 shrink-0 pr-2 text-right text-slate-400 select-none">
                {segment.type !== 'removed' ? segment.newLineNumber : ''}
              </span>
              <span className="diff-line-prefix w-6 shrink-0 text-center font-mono select-none">
                {segment.type === 'added' ? '+' : segment.type === 'removed' ? '-' : ' '}
              </span>
              <span className="diff-line-content flex-grow break-words">
                {segment.text || ' '} {/* Ensure empty lines are rendered */}
              </span>
            </div>
          ))}
        </main>
        <footer className="p-4 border-t border-slate-200 bg-slate-100 flex justify-end shrink-0">
            <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
            >
                Close
            </button>
        </footer>
      </div>
    </div>
  );
};

export default DiffViewerModal;
