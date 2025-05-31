
import React from 'react';
import { FileSystemNodeType } from '../types';
import { PencilSquareIcon, TrashIcon, DocumentPlusIcon, FolderPlusIcon } from './Icons';

interface FileExplorerContextMenuProps {
  x: number;
  y: number;
  targetNode: { id: string; name: string; type: FileSystemNodeType };
  onClose: () => void;
  onRename: (nodeId: string) => void;
  onDelete: (nodeId: string, nodeName: string, nodeType: FileSystemNodeType) => void;
  onCreateFileInFolder: (parentId: string) => void;
  onCreateFolderInFolder: (parentId: string) => void;
}

const FileExplorerContextMenu: React.FC<FileExplorerContextMenuProps> = ({
  x,
  y,
  targetNode,
  onClose,
  onRename,
  onDelete,
  onCreateFileInFolder,
  onCreateFolderInFolder,
}) => {
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscapeKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
        }
      };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

  const menuItems = [
    {
      label: 'Rename',
      action: () => onRename(targetNode.id),
      icon: <PencilSquareIcon className="w-4 h-4 mr-2.5 text-sky-600" />,
    },
    ...(targetNode.type === FileSystemNodeType.FOLDER
      ? [
          {
            label: 'New File Here',
            action: () => onCreateFileInFolder(targetNode.id),
            icon: <DocumentPlusIcon className="w-4 h-4 mr-2.5 text-green-600" />,
          },
          {
            label: 'New Folder Here',
            action: () => onCreateFolderInFolder(targetNode.id),
            icon: <FolderPlusIcon className="w-4 h-4 mr-2.5 text-amber-600" />,
          },
        ]
      : []),
    {
      label: 'Delete',
      action: () => onDelete(targetNode.id, targetNode.name, targetNode.type),
      icon: <TrashIcon className="w-4 h-4 mr-2.5 text-red-600" />,
    },
  ];
  
  const menuItemHeight = 38; 
  const menuPaddingY = 8; 
  const menuWidth = 190; 
  const menuHeight = menuItems.length * menuItemHeight + menuPaddingY;

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  let finalX = x;
  let finalY = y;

  if (x + menuWidth > windowWidth) {
    finalX = windowWidth - menuWidth - 10; 
  }
  if (y + menuHeight > windowHeight) {
    finalY = windowHeight - menuHeight - 10; 
  }
   if (finalX < 10) finalX = 10;
   if (finalY < 10) finalY = 10;


  return (
    <div
      ref={menuRef}
      style={{ top: finalY, left: finalX }}
      className="fixed bg-white border border-slate-300 rounded-lg shadow-xl py-1 z-[60]"
      role="menu"
      aria-orientation="vertical"
      aria-label={`Actions for ${targetNode.name}`}
    >
      {menuItems.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            item.action();
            onClose(); 
          }}
          className="w-full flex items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:text-slate-900 focus:outline-none transition-colors duration-100"
          role="menuitem"
          style={{ minWidth: `${menuWidth -2}px`}}
        >
          {item.icon}
          <span className="font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default FileExplorerContextMenu;