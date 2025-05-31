
import { FileSystemMap, FileNode, FolderNode, FileSystemNodeType } from './types';

const DB_NAME = 'markieDB';
const DB_VERSION = 1;
const STORE_NAME = 'fileSystemStore';
const FS_DATA_KEY = 'mainFileSystemData'; // Key for the single object holding fsMap and activeFileId

const initialMarkdownForDefaultFile = `---
title: Welcome to Markie Editor - Your Intelligent Markdown Workspace!
author: The Markie Team
date: ${new Date().toISOString().split('T')[0]}
version: 2.1 # Updated for footnote feature
tags: [welcome, markdown, editor, ai, markie, file-system, indexeddb, gfm, math, directives, footnotes]
description: An overview of Markie Editor, its features, and your AI assistant, Markie.
---

# Welcome to Markie Editor!

Hi there! This is "Welcome.md", your inaugural file in the **Markie Editor** – a modern, browser-based Markdown editor supercharged with AI and a robust local file system. We're thrilled to have you!

Markie Editor is designed to be your go-to workspace for all things Markdown. Whether you're drafting notes, writing articles, documenting projects, or managing complex information, we've packed it with features to make your experience seamless and powerful.

## Core Editing Power

At its heart, Markie Editor is a sophisticated text editor that fully embraces the power and simplicity of Markdown:

*   **Full Markdown Support:** Write using standard **CommonMark** and enjoy extended syntax with **GitHub Flavored Markdown (GFM)**, including tables, strikethrough, task lists, and more.
*   **Embedded HTML:** Need more control? You can embed raw HTML directly into your Markdown for custom layouts and elements.
*   **Mathematical Expressions:** Integrated **KaTeX** support allows you to write beautiful LaTeX-style math, both inline (\`$E=mc^2$\`) and in display mode (\`$$\\sum_{i=1}^N x_i$$\`).
*   **YAML Frontmatter:** Organize your document metadata with ease. Add titles, authors, tags, dates, or any custom fields using a simple YAML block at the start of your file (enclosed by \`---\`). This metadata is parsed and can be displayed.
*   **Custom Directives:** Extend Markdown's capabilities with custom directives (e.g., \`::note{.custom-class} This is a note. ::\`). Create reusable content blocks and apply special formatting beyond standard syntax.
*   **Footnotes:** Easily add footnotes to your documents for citations or additional explanations.[^1] You can even have multiple footnotes.[^example]

## Meet Markie: Your AI Assistant

Integrated directly into the editor is **Markie**, your intelligent AI companion. Markie can:

*   **Assist with Content:** Help you explain, improve, summarize, translate, or change the tone of your selected text.
*   **Manage Your Files:** Create new files and folders, propose deletions, and navigate your file system based on your instructions. Markie understands the structure of your workspace.
*   **Remember Key Information:** Tell Markie to remember important facts (e.g., project names, deadlines, preferred styles) using simple commands. Markie can also autonomously learn and remember details it deems relevant to assist you better, always informing you of what it has learned.
*   **Answer Questions:** Ask Markie about the editor's features, Markdown syntax, or brainstorm ideas for your content.
*   **Access Up-to-Date Information:** For queries requiring recent knowledge, Markie can use Google Search and will cite its sources.

Interact with Markie through the "Ask Markie" button.

## Your Personal File System

Markie Editor now features a complete client-side file system, stored securely and privately in your browser's **IndexedDB**:

*   **Organize Your Work:** Create a hierarchy of files and folders directly within the editor.
*   **Intuitive File Explorer:** The collapsible sidebar on the left allows you to easily navigate, open, rename, and delete your files and folders.
*   **Automatic Saves:** Your changes are automatically saved to the active file in the file system.
*   **Contextual Actions:** Right-click on files or folders in the explorer for quick actions like "Rename," "Delete," "New File Here," or "New Folder Here."

## Modern User Experience

We believe a powerful tool should also be a pleasure to use:

*   **Clean & Responsive UI:** A modern, intuitive interface designed for focus and efficiency.
*   **Collapsible File Explorer:** Maximize your writing space when needed.
*   **Clear Notifications:** Stay informed about actions and system status.
*   **Download Options:** Export your documents in various formats (MD, HTML, TXT, JSON).

## Getting Started

1.  **Explore:** Take a look around the File Explorer. Try creating a new folder or file.
2.  **Edit This File:** Feel free to modify this "Welcome.md" document. Your changes will be saved.
3.  **Talk to Markie:** Click "Ask Markie" and try asking for help. For example, try asking Markie: "Markie, what are custom directives in this editor?" or "Remember my favorite color is sky blue."
4.  **Try Footnotes:** Look at the footnote examples in this document and try adding your own!

We're constantly working to improve Markie Editor. We hope you enjoy using it as much as we enjoyed building it!

Happy Writing!

---
The Markie Team

[^1]: This is the first footnote. It provides additional details about the preceding statement.
[^example]: Here's another example of a footnote. Footnotes are great for citations or elaborating on a point without cluttering the main text.
`;

// Helper to promisify IndexedDB requests
function promisifyRequest<T = undefined>(request: IDBRequest<T> | IDBOpenDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getFileSystemDataFromDB = async (): Promise<{ fsMap: FileSystemMap, activeFileId: string | null } | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const data = await promisifyRequest<{ fsMap: FileSystemMap, lastActiveFileId?: string }>(store.get(FS_DATA_KEY));
    
    if (data && typeof data.fsMap === 'object' && Object.keys(data.fsMap).length > 0) {
        Object.values(data.fsMap).forEach(node => {
          if (node.type === FileSystemNodeType.FOLDER && !Array.isArray((node as FolderNode).childrenIds)) {
            (node as FolderNode).childrenIds = [];
          }
          if (node.type === FileSystemNodeType.FILE && typeof (node as FileNode).content !== 'string') {
            (node as FileNode).content = '';
          }
          if (node.type === FileSystemNodeType.FOLDER && typeof (node as FolderNode).isExpanded === 'undefined') {
            (node as FolderNode).isExpanded = false;
          }
        });
        
        let activeFileIdToReturn = data.lastActiveFileId || null;
        if (activeFileIdToReturn && (!data.fsMap[activeFileIdToReturn] || data.fsMap[activeFileIdToReturn].type !== FileSystemNodeType.FILE)) {
            activeFileIdToReturn = null;
        }
        if (!activeFileIdToReturn) {
            const firstFile = Object.values(data.fsMap).find(node => node.type === FileSystemNodeType.FILE);
            if (firstFile) activeFileIdToReturn = firstFile.id;
        }
        return { fsMap: data.fsMap, activeFileId: activeFileIdToReturn };
    }
    return null;
  } catch (error) {
    console.error("Failed to load file system from IndexedDB:", error);
    return null;
  }
};

const saveFileSystemToDB = async (fsMap: FileSystemMap, lastActiveFileId: string | null): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await promisifyRequest(store.put({ fsMap, lastActiveFileId }, FS_DATA_KEY));
  } catch (error) {
    console.error("Failed to save file system to IndexedDB:", error);
  }
};

export const createDefaultFileSystem = (): { fsMap: FileSystemMap, defaultFileId: string } => {
  const rootFolderId = crypto.randomUUID();
  const welcomeFileId = crypto.randomUUID();

  const rootFolder: FolderNode = {
    id: rootFolderId,
    name: 'My Documents',
    type: FileSystemNodeType.FOLDER,
    parentId: null,
    childrenIds: [welcomeFileId],
    isExpanded: true,
  };

  const welcomeFile: FileNode = {
    id: welcomeFileId,
    name: 'Welcome.md',
    type: FileSystemNodeType.FILE,
    parentId: rootFolderId,
    content: initialMarkdownForDefaultFile,
  };

  const fsMap: FileSystemMap = {
    [rootFolderId]: rootFolder,
    [welcomeFileId]: welcomeFile,
  };
  return { fsMap, defaultFileId: welcomeFileId };
};

export const loadFileSystem = async (): Promise<{ fsMap: FileSystemMap, activeFileId: string | null }> => {
  const loadedData = await getFileSystemDataFromDB();
  if (loadedData) {
    return loadedData;
  }
  const { fsMap, defaultFileId } = createDefaultFileSystem();
  await saveFileSystemToDB(fsMap, defaultFileId);
  return { fsMap, activeFileId: defaultFileId };
};

export const saveFileSystem = async (fsMap: FileSystemMap, lastActiveFileId: string | null): Promise<void> => {
  await saveFileSystemToDB(fsMap, lastActiveFileId);
};

export const addNodeToStore = (
  currentFsMap: FileSystemMap,
  name: string,
  type: FileSystemNodeType,
  parentId: string | null,
  initialContent: string = ''
): { newFsMap: FileSystemMap, newNodeId: string } => {
  const newNodeId = crypto.randomUUID();
  let newNode: FileNode | FolderNode;

   // Check for name conflicts within the same parent directory
   const siblings = Object.values(currentFsMap).filter(node => node.parentId === parentId);
   if (siblings.some(sibling => sibling.name.toLowerCase() === name.trim().toLowerCase())) {
       // This is a simplified way to handle conflicts. In a real app, you might throw an error or return a specific status.
       // For now, we'll log a warning and proceed, but App.tsx should ideally prevent this upstream or handle the error.
       console.warn(`A node with the name "${name.trim()}" already exists in this folder.`);
       // To make this more robust, you might want to return an error or a special status from this function
       // instead of just logging. For this iteration, we let App.tsx handle the user notification for this.
   }

  if (type === FileSystemNodeType.FILE) {
    newNode = {
      id: newNodeId,
      name: name.trim(),
      type: FileSystemNodeType.FILE,
      parentId,
      content: initialContent,
    };
  } else { // FOLDER
    newNode = {
      id: newNodeId,
      name: name.trim(),
      type: FileSystemNodeType.FOLDER,
      parentId,
      childrenIds: [],
      isExpanded: false,
    };
  }

  const newFsMap = { ...currentFsMap, [newNodeId]: newNode };

  if (parentId && newFsMap[parentId] && newFsMap[parentId].type === FileSystemNodeType.FOLDER) {
    const parentFolder = { ...newFsMap[parentId] } as FolderNode;
    parentFolder.childrenIds = Array.isArray(parentFolder.childrenIds) ? [...parentFolder.childrenIds, newNodeId] : [newNodeId];
    newFsMap[parentId] = parentFolder;
  }
  
  return { newFsMap, newNodeId };
};

export const updateFileContentInStore = (
  currentFsMap: FileSystemMap,
  fileId: string,
  newContent: string
): FileSystemMap => {
  if (currentFsMap[fileId] && currentFsMap[fileId].type === FileSystemNodeType.FILE) {
    const updatedFile = { ...(currentFsMap[fileId] as FileNode), content: newContent };
    return { ...currentFsMap, [fileId]: updatedFile };
  }
  console.warn(`Attempted to update content of non-file or non-existent node: ${fileId}`);
  return currentFsMap;
};

export const toggleFolderExpansionInStore = (
  currentFsMap: FileSystemMap,
  folderId: string
): FileSystemMap => {
  const node = currentFsMap[folderId];
  if (node && node.type === FileSystemNodeType.FOLDER) {
    const updatedFolder = { ...node, isExpanded: !node.isExpanded } as FolderNode;
    return { ...currentFsMap, [folderId]: updatedFolder };
  }
  return currentFsMap;
};

export const renameNodeInStore = (
  currentFsMap: FileSystemMap,
  nodeId: string,
  newName: string
): { updatedFsMap: FileSystemMap; nameChanged: boolean; error?: string } => {
  const nodeToRename = currentFsMap[nodeId];
  if (!nodeToRename) {
    return { updatedFsMap: currentFsMap, nameChanged: false, error: "Node not found." };
  }

  const trimmedNewName = newName.trim();
  if (trimmedNewName === nodeToRename.name) {
    return { updatedFsMap: currentFsMap, nameChanged: false }; // No change needed
  }
  if (trimmedNewName === "") {
    return { updatedFsMap: currentFsMap, nameChanged: false, error: "Name cannot be empty." };
  }


  // Check for name conflicts within the same parent directory
  const siblings = Object.values(currentFsMap).filter(
    node => node.parentId === nodeToRename.parentId && node.id !== nodeId
  );

  if (siblings.some(sibling => sibling.name.toLowerCase() === trimmedNewName.toLowerCase())) {
    return { 
      updatedFsMap: currentFsMap, 
      nameChanged: false, 
      error: `A node named "${trimmedNewName}" already exists in this location.` 
    };
  }

  const updatedNode = { ...nodeToRename, name: trimmedNewName };
  const updatedFsMap = { ...currentFsMap, [nodeId]: updatedNode };
  
  return { updatedFsMap, nameChanged: true };
};


export const deleteNodeFromStore = (
  currentFsMap: FileSystemMap,
  nodeIdToDelete: string
): FileSystemMap => {
  const newFsMap = { ...currentFsMap };
  const nodeToDelete = newFsMap[nodeIdToDelete];

  if (!nodeToDelete) {
    console.warn(`Node with ID ${nodeIdToDelete} not found for deletion.`);
    return currentFsMap;
  }

  const nodesToRemove = new Set<string>();
  
  // Helper function to recursively find all children of a folder
  const findAllDescendants = (folderId: string) => {
    nodesToRemove.add(folderId);
    const folder = newFsMap[folderId] as FolderNode;
    if (folder && folder.type === FileSystemNodeType.FOLDER && folder.childrenIds) {
      folder.childrenIds.forEach(childId => {
        const childNode = newFsMap[childId];
        if (childNode) {
          if (childNode.type === FileSystemNodeType.FOLDER) {
            findAllDescendants(childId);
          } else {
            nodesToRemove.add(childId);
          }
        }
      });
    }
  };

  if (nodeToDelete.type === FileSystemNodeType.FOLDER) {
    findAllDescendants(nodeIdToDelete);
  } else {
    nodesToRemove.add(nodeIdToDelete);
  }

  // Remove nodes from the map
  nodesToRemove.forEach(id => {
    delete newFsMap[id];
  });

  // Update parent's childrenIds
  if (nodeToDelete.parentId && newFsMap[nodeToDelete.parentId]) {
    const parentFolder = { ...newFsMap[nodeToDelete.parentId] } as FolderNode;
    if (parentFolder.childrenIds) {
      parentFolder.childrenIds = parentFolder.childrenIds.filter(id => id !== nodeIdToDelete);
      newFsMap[nodeToDelete.parentId] = parentFolder;
    }
  }
  
  // Also, update childrenIds of any folder that might have contained one of the deleted nodes
  // (This is mostly for safety, primary removal is from direct parent)
  for (const id in newFsMap) {
    const node = newFsMap[id];
    if (node.type === FileSystemNodeType.FOLDER) {
      const folderNode = node as FolderNode;
      folderNode.childrenIds = folderNode.childrenIds.filter(childId => !nodesToRemove.has(childId));
    }
  }

  return newFsMap;
};


export { initialMarkdownForDefaultFile };