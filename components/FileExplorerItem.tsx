
import React, { useState, useEffect, useRef } from 'react';
import { FileSystemNode, FolderNode, FileNode, FileSystemNodeType, FileSystemMap } from '../types';
import { FolderIcon, FolderOpenIcon, DocumentTextIcon, ChevronRightIcon, ChevronDownIcon, PencilSquareIcon } from './Icons';

interface FileExplorerItemProps {
  node: FileSystemNode;
  fileSystemMap: FileSystemMap;
  level: number;
  activeFileId: string | null;
  renamingNodeId: string | null;
  onOpenFile: (fileId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onContextMenu: (event: React.MouseEvent, nodeId: string, nodeName: string, nodeType: FileSystemNodeType) => void;
  onStartRename: (nodeId: string) => void;
  onConfirmRename: (nodeId: string, newName: string) => void;
  onCancelRename: () => void;
}

const FileExplorerItem: React.FC<FileExplorerItemProps> = ({
  node,
  fileSystemMap,
  level,
  activeFileId,
  renamingNodeId,
  onOpenFile,
  onToggleFolder,
  onContextMenu,
  onStartRename,
  onConfirmRename,
  onCancelRename,
}) => {
  const isRenamingThisNode = renamingNodeId === node.id;
  const [currentName, setCurrentName] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenamingThisNode) {
      setCurrentName(node.name); 
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenamingThisNode, node.name]);
  
  useEffect(() => { 
    if (!isRenamingThisNode && currentName !== node.name) {
        setCurrentName(node.name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRenamingThisNode, node.name]);


  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentName(event.target.value);
  };

  const handleConfirmRename = () => {
    if (currentName.trim() === '') {
      onCancelRename(); 
      setCurrentName(node.name); 
    } else if (currentName.trim() !== node.name) {
      onConfirmRename(node.id, currentName.trim());
    } else {
      onCancelRename(); 
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleConfirmRename();
    } else if (event.key === 'Escape') {
      setCurrentName(node.name); 
      onCancelRename();
    }
  };

  const handleBlur = () => {
    if (currentName.trim() !== node.name && currentName.trim() !== '') {
        handleConfirmRename();
    } else if (currentName.trim() === '') { 
        setCurrentName(node.name);
        onCancelRename();
    } else { 
        onCancelRename();
    }
  };

  const indent = level * 16; 
  const basePaddingLeft = 8; 

  if (node.type === FileSystemNodeType.FILE) {
    const file = node as FileNode;
    const isActive = file.id === activeFileId;
    return (
      <div
        onContextMenu={(e) => onContextMenu(e, file.id, file.name, file.type)}
        className={`group w-full flex items-center text-left pr-1.5 py-1.5 rounded-md transition-colors duration-100 cursor-pointer ${
          isActive 
            ? 'bg-sky-200 text-sky-800 font-semibold border-l-4 border-sky-500' 
            : 'text-slate-700 hover:bg-sky-100 hover:text-sky-700 focus-within:bg-sky-100'
        }`}
        style={{ paddingLeft: `${indent + basePaddingLeft - (isActive ? 4 : 0)}px` }} // Adjust padding for border
        role="button"
        tabIndex={0}
        onClick={isRenamingThisNode ? undefined : () => onOpenFile(file.id)}
        onKeyDown={isRenamingThisNode ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') onOpenFile(file.id);}}
        aria-current={isActive ? 'page' : undefined}
      >
        <DocumentTextIcon className={`w-4 h-4 mr-2 shrink-0 ${isActive ? 'text-sky-700' : 'text-slate-500 group-hover:text-sky-600'}`} />
        {isRenamingThisNode ? (
          <input
            ref={inputRef}
            type="text"
            value={currentName}
            onChange={handleNameChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="flex-grow p-0.5 -m-0.5 text-sm bg-white border border-sky-400 rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
            aria-label={`Rename file ${node.name}`}
          />
        ) : (
          <span className="truncate flex-grow text-sm">{file.name}</span>
        )}
        {!isRenamingThisNode && (
            <button 
                onClick={(e) => { e.stopPropagation(); onStartRename(node.id); }}
                className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-sky-200 focus:outline-none focus:ring-1 focus:ring-sky-400"
                aria-label={`Rename ${file.name}`}
                title="Rename"
            >
                <PencilSquareIcon className="w-3.5 h-3.5 text-slate-500 hover:text-sky-600" />
            </button>
        )}
      </div>
    );
  }

  if (node.type === FileSystemNodeType.FOLDER) {
    const folder = node as FolderNode;
    const isExpanded = folder.isExpanded ?? false;
    return (
      <div onContextMenu={(e) => onContextMenu(e, folder.id, folder.name, folder.type)} className="my-0.5">
        <div
          className={`group w-full flex items-center text-left pr-1.5 py-1.5 rounded-md hover:bg-slate-200 focus-within:bg-slate-200 transition-colors duration-100 text-slate-800 cursor-pointer`}
          style={{ paddingLeft: `${indent + basePaddingLeft}px` }}
          role="button"
          tabIndex={0}
          onClick={isRenamingThisNode ? undefined : () => onToggleFolder(folder.id)}
          onKeyDown={isRenamingThisNode ? undefined :(e) => { if (e.key === 'Enter' || e.key === ' ') onToggleFolder(folder.id);}}
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <ChevronDownIcon className="w-3.5 h-3.5 mr-1 shrink-0 text-slate-500 group-hover:text-slate-700" />
          ) : (
            <ChevronRightIcon className="w-3.5 h-3.5 mr-1 shrink-0 text-slate-500 group-hover:text-slate-700" />
          )}
          {isExpanded ? (
            <FolderOpenIcon className="w-4 h-4 mr-1.5 shrink-0 text-amber-500 group-hover:text-amber-600" />
          ) : (
            <FolderIcon className="w-4 h-4 mr-1.5 shrink-0 text-amber-500 group-hover:text-amber-600" />
          )}
          {isRenamingThisNode ? (
            <input
              ref={inputRef}
              type="text"
              value={currentName}
              onChange={handleNameChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              className="flex-grow p-0.5 -m-0.5 text-sm font-medium bg-white border border-sky-400 rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
              aria-label={`Rename folder ${node.name}`}
            />
          ) : (
            <span className="font-medium truncate flex-grow text-sm">{folder.name}</span>
          )}
           {!isRenamingThisNode && (
            <button 
                onClick={(e) => { e.stopPropagation(); onStartRename(node.id); }}
                className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400"
                aria-label={`Rename ${folder.name}`}
                title="Rename"
            >
                <PencilSquareIcon className="w-3.5 h-3.5 text-slate-500 hover:text-slate-700" />
            </button>
        )}
        </div>
        {folder.childrenIds.length > 0 && (
          <div
            className={`file-explorer-children-container mt-0.5 
                        ${isExpanded ? 'max-h-[1000px] opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-95 pointer-events-none'}`}
            aria-hidden={!isExpanded}
          >
            {folder.childrenIds
             .map(childId => fileSystemMap[childId])
             .filter(Boolean) 
             .sort((a, b) => {
                if (a.type === FileSystemNodeType.FOLDER && b.type === FileSystemNodeType.FILE) return -1;
                if (a.type === FileSystemNodeType.FILE && b.type === FileSystemNodeType.FOLDER) return 1;
                return a.name.localeCompare(b.name);
              })
            .map(childNode => (
                <FileExplorerItem
                  key={childNode.id}
                  node={childNode}
                  fileSystemMap={fileSystemMap}
                  level={level + 1}
                  activeFileId={activeFileId}
                  renamingNodeId={renamingNodeId}
                  onOpenFile={onOpenFile}
                  onToggleFolder={onToggleFolder}
                  onContextMenu={onContextMenu}
                  onStartRename={onStartRename}
                  onConfirmRename={onConfirmRename}
                  onCancelRename={onCancelRename}
                />
              )
            )}
          </div>
        )}
        {isExpanded && folder.childrenIds.length === 0 && !isRenamingThisNode && (
            <p 
              className="text-xs text-slate-400 italic"
              style={{ paddingLeft: `${indent + basePaddingLeft + 16 + 4}px` }} 
            >
              (empty)
            </p>
        )}
      </div>
    );
  }
  return null;
};

export default FileExplorerItem;
