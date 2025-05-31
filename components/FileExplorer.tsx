
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileSystemMap, FileSystemNode, FileSystemNodeType } from '../types';
import { DocumentPlusIcon, FolderPlusIcon } from './Icons';
import FileExplorerItem from './FileExplorerItem';
import FileExplorerContextMenu from './FileExplorerContextMenu';

interface FileExplorerProps {
  fileSystemMap: FileSystemMap;
  activeFileId: string | null;
  renamingNodeId: string | null;
  rootItemIds: string[];

  onOpenFile: (fileId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onCreateFile: (parentId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onStartRename: (nodeId: string) => void;
  onConfirmRename: (nodeId: string, newName: string) => void;
  onCancelRename: () => void;
  onUserProposeDelete: (nodeId: string, nodeName: string, nodeType: FileSystemNodeType) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetNode: { id: string; name: string; type: FileSystemNodeType } | null;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  fileSystemMap,
  activeFileId,
  renamingNodeId,
  rootItemIds,
  onOpenFile,
  onToggleFolder,
  onCreateFile,
  onCreateFolder,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onUserProposeDelete,
}) => {
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetNode: null,
  });
  const explorerRef = useRef<HTMLDivElement>(null);


  const handleContextMenu = useCallback((
    event: React.MouseEvent,
    nodeId: string,
    nodeName: string,
    nodeType: FileSystemNodeType
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (renamingNodeId && renamingNodeId !== nodeId) {
        onCancelRename();
    }
    setContextMenuState({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      targetNode: { id: nodeId, name: nodeName, type: nodeType },
    });
  }, [renamingNodeId, onCancelRename]);

  const closeContextMenu = useCallback(() => {
    setContextMenuState(prev => ({ ...prev, visible: false, targetNode: null }));
  }, []);

  useEffect(() => {
    if (renamingNodeId && contextMenuState.targetNode && renamingNodeId !== contextMenuState.targetNode.id) {
      closeContextMenu();
    }
  }, [renamingNodeId, contextMenuState.targetNode, closeContextMenu]);
  
  const sortedRootItemIds = [...rootItemIds].sort((aId, bId) => {
    const aNode = fileSystemMap[aId];
    const bNode = fileSystemMap[bId];
    if (!aNode || !bNode) return 0;
    if (aNode.type === FileSystemNodeType.FOLDER && bNode.type === FileSystemNodeType.FILE) return -1;
    if (aNode.type === FileSystemNodeType.FILE && bNode.type === FileSystemNodeType.FOLDER) return 1;
    return aNode.name.localeCompare(bNode.name);
  });

  const actionButtonClass = "flex items-center w-full px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-800 rounded-md transition-colors duration-100 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-slate-200";

  return (
    <div ref={explorerRef} className="h-full flex flex-col bg-slate-100 text-slate-700"> {/* Changed background */}
      <div className="p-3 border-b border-slate-300">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 mb-2">Explorer</h2>
        <div className="space-y-1.5">
          <button
            onClick={() => { closeContextMenu(); onCreateFile(null); }}
            className={actionButtonClass}
            aria-label="Create new file in root"
          >
            <DocumentPlusIcon className="w-4 h-4 mr-2 text-sky-600" /> New File
          </button>
          <button
            onClick={() => { closeContextMenu(); onCreateFolder(null); }}
            className={actionButtonClass}
            aria-label="Create new folder in root"
          >
            <FolderPlusIcon className="w-4 h-4 mr-2 text-amber-600" /> New Folder
          </button>
        </div>
      </div>
      <div className="flex-grow p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-slate-200">
        {sortedRootItemIds.length === 0 && !Object.keys(fileSystemMap).some(id => fileSystemMap[id].parentId !== null) && (
          <p className="text-xs text-slate-500 p-2 italic">No files or folders yet. Click above to create.</p>
        )}
        {sortedRootItemIds.map(nodeId => {
          const node = fileSystemMap[nodeId];
          return node ? (
            <FileExplorerItem
              key={node.id}
              node={node}
              fileSystemMap={fileSystemMap}
              level={0}
              activeFileId={activeFileId}
              renamingNodeId={renamingNodeId}
              onOpenFile={onOpenFile}
              onToggleFolder={onToggleFolder}
              onContextMenu={handleContextMenu}
              onStartRename={onStartRename}
              onConfirmRename={onConfirmRename}
              onCancelRename={onCancelRename}
            />
          ) : null;
        })}
      </div>
      {contextMenuState.visible && contextMenuState.targetNode && (
        <FileExplorerContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          targetNode={contextMenuState.targetNode}
          onClose={closeContextMenu}
          onRename={onStartRename}
          onDelete={onUserProposeDelete}
          onCreateFileInFolder={(parentId) => { onCreateFile(parentId); }}
          onCreateFolderInFolder={(parentId) => { onCreateFolder(parentId);}}
        />
      )}
    </div>
  );
};

export default FileExplorer;