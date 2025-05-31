
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { 
  EditorMode, ChatMessage, ChatParticipant, GroundingChunk, 
  FileSystemMap, FileSystemNodeType, FileNode, FolderNode, UserPreferences, FileSystemNode,
  MarkieFileSystemAction, MarkieFileSystemActionType, CreateFilePayload, CreateFolderPayload, 
  ProposeDeletePayload, NavigateToFilePayload, ReadFileContentPayload,
  NotificationState // Imported from types.ts
} from './types'; 
import { 
  loadFileSystem, saveFileSystem, addNodeToStore, updateFileContentInStore, 
  toggleFolderExpansionInStore, initialMarkdownForDefaultFile, createDefaultFileSystem,
  deleteNodeFromStore, renameNodeInStore
} from './fileSystemManager';
import { 
  parseMarkdownWithFrontmatter, // Imported from utils.ts
  getProseStylesForHtmlDownload // Imported from utils.ts
} from './utils';
import ModeToggleButton from './components/ModeToggleButton';
import Editor from './components/Editor';
import Viewer from './components/Viewer';
import AskMarkieButton from './components/AskMarkieButton';
import ChatPage from './ChatPage'; 
import ConfirmationModal from './components/ConfirmationModal';
import NameInputModal from './components/NameInputModal'; 
import FileExplorer from './components/FileExplorer';
import yaml from 'js-yaml';
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';
import { math, mathHtml } from 'micromark-extension-math';
import { directive, directiveHtml } from 'micromark-extension-directive';
import { footnote, footnoteHtml } from 'micromark-extension-footnote'; // Import footnote plugins
import { UndoIcon, ArrowLeftIcon, DocumentDuplicateIcon, ArrowDownTrayIcon, CheckCircleIcon, InformationCircleIcon, ExclamationTriangleIcon, XCircleIcon, ChevronDownIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from './components/Icons';
import type { FrontmatterData } from './types'; // Now imported from types.ts


type DownloadFormat = 'md' | 'txt' | 'html' | 'json';

const LOCAL_STORAGE_MODE_KEY = 'markieEditorMode_v2'; 

// parseMarkdownWithFrontmatter MOVED to utils.ts

type CurrentPage = 'editor' | 'chat';

// NotificationState MOVED to types.ts

export interface PendingChatAction {
  prompt: string;
  isInternalReprompt?: boolean; 
}

interface NameInputModalConfig {
  type: FileSystemNodeType;
  parentId: string | null;
}


const App: React.FC = () => {
  // --- State Hooks ---
  const [mode, setMode] = useState<EditorMode>(() => {
    try {
      const savedMode = localStorage.getItem(LOCAL_STORAGE_MODE_KEY) as EditorMode | null;
      return savedMode && Object.values(EditorMode).includes(savedMode) ? savedMode : EditorMode.VIEW;
    } catch (error) {
      console.warn("Failed to load editor mode from localStorage:", error);
      return EditorMode.VIEW;
    }
  });

  const [fileSystem, setFileSystem] = useState<FileSystemMap>({});
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isLoadingFileSystem, setIsLoadingFileSystem] = useState(true);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  
  const [markdownText, setMarkdownText] = useState<string>(''); 
  const [parsedFrontmatter, setParsedFrontmatter] = useState<FrontmatterData>(null);
  const [contentMarkdownBody, setContentMarkdownBody] = useState<string>('');
  
  const [previousMarkdownTextForUndo, setPreviousMarkdownTextForUndo] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<CurrentPage>('editor');
  const [apiKeyExistsInitialCheck, setApiKeyExistsInitialCheck] = useState<boolean | null>(null);
  
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [isClearConfirmationOpen, setIsClearConfirmationOpen] = useState(false);
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);

  const [pendingChatAction, setPendingChatAction] = useState<PendingChatAction | null>(null);

  const [isDeleteNodeConfirmationOpen, setIsDeleteNodeConfirmationOpen] = useState(false);
  const [nodeToDeleteInfo, setNodeToDeleteInfo] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{ visible: boolean; targetNodeId?: string; }>({ visible: false }); // For File Explorer Context Menu
  
  const [isFileExplorerVisible, setIsFileExplorerVisible] = useState(true);
  const [isNameInputModalOpen, setIsNameInputModalOpen] = useState(false);
  const [nameInputModalConfig, setNameInputModalConfig] = useState<NameInputModalConfig | null>(null);


  // --- Ref Hooks ---
  const downloadDropdownRef = useRef<HTMLDivElement>(null);

  // --- Memoized Hooks ---
  const rootItemIds = useMemo(() => Object.values(fileSystem)
    .filter(node => node.parentId === null)
    .map(node => node.id), [fileSystem]);

  // --- Callback Hooks ---
  const displayNotification = useCallback((message: string, type: NotificationState['type'], duration: number = 4000) => {
    const newNotification = { id: crypto.randomUUID(), message, type };
    setNotification(newNotification);
    setIsNotificationVisible(true);
  
    setTimeout(() => {
      setIsNotificationVisible(false); 
      setTimeout(() => {
        setNotification(currentNotification => 
          currentNotification?.id === newNotification.id ? null : currentNotification
        );
      }, 500); // Wait for fade out animation
    }, duration);
  }, []);

  const closeFileExplorerContextMenu = useCallback(() => { // Renamed for clarity
    setContextMenuState({ visible: false });
  }, []);

  const handleToggleMode = useCallback(() => {
    setMode((prevMode) =>
      prevMode === EditorMode.EDIT ? EditorMode.VIEW : EditorMode.EDIT
    );
  }, []);

  const handleTextChangeInEditor = useCallback((newText: string) => {
    setMarkdownText(newText); 
    if (activeFileId) {
      setFileSystem(currentFs => updateFileContentInStore(currentFs, activeFileId, newText));
    }
  }, [activeFileId]);

  const handleOpenFile = useCallback((fileId: string) => {
    if (renamingNodeId) setRenamingNodeId(null);
    const fileNode = fileSystem[fileId];
    if (fileNode && fileNode.type === FileSystemNodeType.FILE) {
      setActiveFileId(fileId);
      setMarkdownText((fileNode as FileNode).content);
      setPreviousMarkdownTextForUndo(null); 
      setMode(EditorMode.VIEW); 
      displayNotification(`Opened "${fileNode.name}"`, "info", 2000);
      return true; 
    }
    displayNotification(`Could not open file.`, "warning", 3000);
    return false; 
  }, [fileSystem, displayNotification, renamingNodeId]);
  
  const handleToggleFolder = useCallback((folderId: string) => {
     if (renamingNodeId) setRenamingNodeId(null);
    setFileSystem(currentFs => toggleFolderExpansionInStore(currentFs, folderId));
  }, [renamingNodeId]);

  const handleCreateNode = useCallback((
    type: FileSystemNodeType, 
    parentId: string | null, 
    prefilledName?: string, 
    initialFileContent: string = ''
  ) => {
    if (renamingNodeId) setRenamingNodeId(null);
    
    if (!prefilledName) { // User initiated action
      setNameInputModalConfig({ type, parentId });
      setIsNameInputModalOpen(true);
      return null; 
    }
    
    // Markie initiated action (prefilledName exists)
    const name = prefilledName.trim();
    const siblings = Object.values(fileSystem).filter(node => node.parentId === parentId);
    const conflictingSibling = siblings.find(s => s.name.toLowerCase() === name.toLowerCase());

    if (conflictingSibling) {
        displayNotification(`Error: A ${conflictingSibling.type === FileSystemNodeType.FILE ? 'file' : 'folder'} named "${name}" already exists here.`, "error");
        return null;
    }

    const { newFsMap, newNodeId } = addNodeToStore(fileSystem, name, type, parentId, type === FileSystemNodeType.FILE ? initialFileContent : undefined);
    setFileSystem(newFsMap);
    
    const nodeTypeString = type === FileSystemNodeType.FILE ? 'File' : 'Folder';
    if (type === FileSystemNodeType.FILE) {
        handleOpenFile(newNodeId); 
    }
    
    displayNotification(`Markie created ${nodeTypeString.toLowerCase()} "${name}".`, "success");
    return newNodeId;
  }, [fileSystem, handleOpenFile, displayNotification, renamingNodeId]);


  const handleConfirmNameInputForNodeCreation = useCallback((name: string) => {
    if (!nameInputModalConfig) return;

    const { type, parentId } = nameInputModalConfig;
    const trimmedName = name.trim();

    const siblings = Object.values(fileSystem).filter(node => node.parentId === parentId);
    const conflictingSibling = siblings.find(s => s.name.toLowerCase() === trimmedName.toLowerCase());
    
    if (conflictingSibling) {
        displayNotification(`Error: A ${conflictingSibling.type === FileSystemNodeType.FILE ? 'file' : 'folder'} named "${trimmedName}" already exists here.`, "error");
        setIsNameInputModalOpen(false);
        setNameInputModalConfig(null);
        return;
    }

    const { newFsMap, newNodeId } = addNodeToStore(fileSystem, trimmedName, type, parentId, type === FileSystemNodeType.FILE ? '' : undefined);
    setFileSystem(newFsMap);
    
    const nodeTypeString = type === FileSystemNodeType.FILE ? 'File' : 'Folder';
    if (type === FileSystemNodeType.FILE) {
        handleOpenFile(newNodeId); 
    }
    displayNotification(`${nodeTypeString} "${trimmedName}" created.`, "success");

    setIsNameInputModalOpen(false);
    setNameInputModalConfig(null);
  }, [nameInputModalConfig, fileSystem, handleOpenFile, displayNotification]);

  const handleCancelNameInputModal = useCallback(() => {
    setIsNameInputModalOpen(false);
    setNameInputModalConfig(null);
    displayNotification("Creation cancelled.", "info", 2000);
  }, [displayNotification]);


  const handleStartRename = useCallback((nodeId: string) => {
    if (contextMenuState.visible) closeFileExplorerContextMenu(); // Use renamed clearer function
    setRenamingNodeId(nodeId);
  }, [contextMenuState.visible, closeFileExplorerContextMenu]);

  const handleConfirmRename = useCallback((nodeId: string, newName: string) => {
    const result = renameNodeInStore(fileSystem, nodeId, newName);
    if (result.nameChanged) {
      setFileSystem(result.updatedFsMap);
      displayNotification(`Renamed to "${newName}".`, "success");
    } else if (result.error) {
      displayNotification(result.error, "error");
    }
    setRenamingNodeId(null);
  }, [fileSystem, displayNotification]);

  const handleCancelRename = useCallback(() => {
    setRenamingNodeId(null);
  }, []);

  const handleUserProposeDelete = useCallback((nodeId: string, nodeName: string, nodeType: FileSystemNodeType) => {
    if (contextMenuState.visible) closeFileExplorerContextMenu(); // Use renamed clearer function
    setNodeToDeleteInfo({ id: nodeId, name: nodeName, type: nodeType === FileSystemNodeType.FILE ? 'file' : 'folder' });
    setIsDeleteNodeConfirmationOpen(true);
  }, [contextMenuState.visible, closeFileExplorerContextMenu]);
  
  const handleMarkieResponseActions = useCallback((
    actions: MarkieFileSystemAction[],
    _updatedPrefs: UserPreferences,
    originalUserQuery?: string 
  ) => {
    actions.forEach(action => {
      switch (action.type) {
        case MarkieFileSystemActionType.CREATE_FILE: {
          const payload = action.payload as CreateFilePayload;
          handleCreateNode(FileSystemNodeType.FILE, payload.parentId, payload.fileName, payload.initialContent || '');
          break;
        }
        case MarkieFileSystemActionType.CREATE_FOLDER: {
          const payload = action.payload as CreateFolderPayload;
          handleCreateNode(FileSystemNodeType.FOLDER, payload.parentId, payload.folderName);
          break;
        }
        case MarkieFileSystemActionType.PROPOSE_DELETE: {
          const payload = action.payload as ProposeDeletePayload;
          const nodeType = fileSystem[payload.nodeId]?.type === FileSystemNodeType.FILE ? 'file' : 'folder';
          setNodeToDeleteInfo({ id: payload.nodeId, name: payload.nodeName, type: nodeType });
          setIsDeleteNodeConfirmationOpen(true);
          break;
        }
        case MarkieFileSystemActionType.NAVIGATE_TO_FILE: {
          const payload = action.payload as NavigateToFilePayload;
          if (!handleOpenFile(payload.fileId)) {
            displayNotification(`Markie tried to open a file, but it couldn't be found.`, "warning");
          }
          break;
        }
        case MarkieFileSystemActionType.READ_FILE_CONTENT: {
          const payload = action.payload as ReadFileContentPayload;
          const fileToRead = fileSystem[payload.fileId];
          if (fileToRead && fileToRead.type === FileSystemNodeType.FILE) {
            const fileContent = (fileToRead as FileNode).content;
            const augmentedPrompt = `Original User Query: ${originalUserQuery || 'The user asked a question that required reading a file.'}
--- REQUESTED FILE CONTENT START (${fileToRead.name}) ---
${fileContent}
--- REQUESTED FILE CONTENT END ---
Now, please answer the original user query based *only* on this provided content and the original query. Do not refer to the file system structure again for this specific task unless the original query explicitly asked for it.`;
            
            setPendingChatAction({ prompt: augmentedPrompt, isInternalReprompt: true });
            if (currentPage !== 'chat') setCurrentPage('chat');
            displayNotification(`Markie is reading "${fileToRead.name}" to answer your query.`, "info", 3000);
          } else {
            displayNotification(`Error: Markie tried to read "${fileToRead?.name || payload.fileId}", but it's not a valid file or couldn't be found.`, "error");
          }
          break;
        }
        default:
          console.warn('Unknown Markie File System Action:', action);
      }
    });
  }, [fileSystem, handleCreateNode, handleOpenFile, displayNotification, currentPage]);

  const clearPendingChatAction = useCallback(() => {
    setPendingChatAction(null);
  }, []);

  // --- Effect Hooks ---
  useEffect(() => {
    const initFileSystem = async () => {
      setIsLoadingFileSystem(true);
      try {
        const { fsMap, activeFileId: loadedActiveFileId } = await loadFileSystem();
        setFileSystem(fsMap);
        if (loadedActiveFileId && fsMap[loadedActiveFileId]?.type === FileSystemNodeType.FILE) {
          setActiveFileId(loadedActiveFileId);
          setMarkdownText((fsMap[loadedActiveFileId] as FileNode).content);
        } else {
          const firstFile = Object.values(fsMap).find(node => node.type === FileSystemNodeType.FILE) as FileNode | undefined;
          if (firstFile) {
            setActiveFileId(firstFile.id);
            setMarkdownText(firstFile.content);
          } else {
             const { fsMap: defaultFsMap, defaultFileId } = createDefaultFileSystem(); 
             setFileSystem(defaultFsMap);
             setActiveFileId(defaultFileId);
             setMarkdownText(initialMarkdownForDefaultFile);
             await saveFileSystem(defaultFsMap, defaultFileId);
             console.warn("No files found on load, created and set default file.");
          }
        }
      } catch (error) {
        console.error("Error initializing file system:", error);
        const { fsMap: defaultFsMap, defaultFileId } = createDefaultFileSystem(); 
        setFileSystem(defaultFsMap);
        setActiveFileId(defaultFileId);
        setMarkdownText(initialMarkdownForDefaultFile);
        await saveFileSystem(defaultFsMap, defaultFileId);
        displayNotification("Error loading file system. Using default.", "error", 5000);
      } finally {
        setIsLoadingFileSystem(false);
      }
    };
    initFileSystem();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    if (!isLoadingFileSystem && Object.keys(fileSystem).length > 0) { 
      saveFileSystem(fileSystem, activeFileId)
        .catch(err => console.error("Failed to save file system:", err));
    }
  }, [fileSystem, activeFileId, isLoadingFileSystem]);

  useEffect(() => {
    if (process.env.API_KEY) {
      setApiKeyExistsInitialCheck(true);
    } else {
      setApiKeyExistsInitialCheck(false);
      console.warn("API_KEY not found. Markie features in chat page will be limited.");
      if (!isLoadingFileSystem) { 
         displayNotification("API_KEY not found. Markie features will be limited.", "warning", 5000);
      }
    }
  }, [displayNotification, isLoadingFileSystem]);

  useEffect(() => {
    const { frontmatter, content } = parseMarkdownWithFrontmatter(markdownText);
    setParsedFrontmatter(frontmatter);
    setContentMarkdownBody(content);
    
    setCharCount(markdownText.length);
    const words = markdownText.trim().split(/\s+/).filter(Boolean);
    setWordCount(markdownText.trim() === '' ? 0 : words.length);
    
  }, [markdownText]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_MODE_KEY, mode);
    } catch (error) {
      console.warn("Failed to save editor mode to localStorage:", error);
    }
  }, [mode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(event.target as Node)) {
        setIsDownloadDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  useEffect(() => {
    if (renamingNodeId || activeFileId) {
        closeFileExplorerContextMenu(); // Use renamed clearer function
    }
  }, [renamingNodeId, activeFileId, closeFileExplorerContextMenu]);


  // --- Navigation ---
  const navigateToChatPage = () => setCurrentPage('chat');
  const navigateToEditorPage = () => setCurrentPage('editor');

  // --- Action Handlers ---
  const applyMarkieEditFromChat = (editedDocumentText: string, _messageIdToUpdate?: string) => {
    if (activeFileId) {
      setPreviousMarkdownTextForUndo(markdownText); 
      setMarkdownText(editedDocumentText); 
      setFileSystem(currentFs => updateFileContentInStore(currentFs, activeFileId, editedDocumentText)); 
      navigateToEditorPage(); 
      displayNotification("Markie's suggested document update has been applied.", "success", 5000);
    } else {
      displayNotification("No active file to apply changes to.", "warning");
    }
  };

  const handleUndoLastAction = () => {
    if (previousMarkdownTextForUndo !== null && activeFileId) {
      setMarkdownText(previousMarkdownTextForUndo);
      setFileSystem(currentFs => updateFileContentInStore(currentFs, activeFileId, previousMarkdownTextForUndo));
      setPreviousMarkdownTextForUndo(null); 
      displayNotification("Last action has been undone.", "success");
    }
  };

  const openClearConfirmation = () => setIsClearConfirmationOpen(true);
  const closeClearConfirmation = () => setIsClearConfirmationOpen(false);

  const handleConfirmClearEditor = () => {
    if (activeFileId) {
      setPreviousMarkdownTextForUndo(markdownText);
      setMarkdownText('');
      setFileSystem(currentFs => updateFileContentInStore(currentFs, activeFileId, ''));
      displayNotification(`Content of "${fileSystem[activeFileId]?.name || 'current file'}" cleared. You can undo.`, "info", 5000);
    }
    closeClearConfirmation();
  };

  const handleCopyDocument = () => {
    if (!activeFileId) {
      displayNotification("No active file to copy.", "warning");
      return;
    }
    navigator.clipboard.writeText(markdownText)
      .then(() => {
        displayNotification(`Content of "${fileSystem[activeFileId]?.name || 'current file'}" copied!`, "success");
      })
      .catch(err => {
        console.error('Failed to copy document: ', err);
        displayNotification("Failed to copy document.", "error");
      });
  };

  // getProseStylesForHtmlDownload MOVED to utils.ts

  const handleDownloadDocument = (format: DownloadFormat) => {
    if (!activeFileId || !fileSystem[activeFileId]) {
      displayNotification("No active file to download.", "warning");
      return;
    }
    
    const activeFileNode = fileSystem[activeFileId] as FileNode;
    const currentFileContent = activeFileNode.content;
    const currentFileName = activeFileNode.name;

    let fileContent = '';
    let mimeType = '';
    let fileExtension = '';
    
    const { frontmatter: currentFrontmatter, content: currentContentBody } = parseMarkdownWithFrontmatter(currentFileContent);
    const docTitleFromFrontmatter = currentFrontmatter?.title ? String(currentFrontmatter.title) : currentFileName.replace(/\.[^/.]+$/, ""); 
    const filenameBase = docTitleFromFrontmatter.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');


    switch (format) {
      case 'md':
        fileContent = currentFileContent;
        mimeType = 'text/markdown;charset=utf-8';
        fileExtension = 'md';
        break;
      case 'txt':
        fileContent = currentFileContent; 
        mimeType = 'text/plain;charset=utf-8';
        fileExtension = 'txt';
        break;
      case 'json':
        const jsonData = {
          title: currentFrontmatter?.title || currentFileName.replace(/\.[^/.]+$/, ""),
          frontmatter: currentFrontmatter,
          content: currentContentBody,
          source: currentFileContent,
          fileName: currentFileName,
        };
        fileContent = JSON.stringify(jsonData, null, 2);
        mimeType = 'application/json;charset=utf-8';
        fileExtension = 'json';
        break;
      case 'html':
        const renderedContentHtml = micromark(currentContentBody, {
          allowDangerousHtml: true,
          extensions: [gfm(), math(), directive(), footnote()], // Added footnote
          htmlExtensions: [gfmHtml(), mathHtml(), directiveHtml(), footnoteHtml()], // Added footnoteHtml
        });

        let frontmatterHtmlDisplay = '';
        if (currentFrontmatter && Object.keys(currentFrontmatter).length > 0) {
          try {
            const frontmatterYaml = yaml.dump(currentFrontmatter);
            frontmatterHtmlDisplay = `
<div class="frontmatter-display">
  <h4>Document Metadata (Frontmatter)</h4>
  <pre>${frontmatterYaml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</div>`;
          } catch (e) {
            console.error("Error dumping frontmatter to YAML for HTML download:", e);
            frontmatterHtmlDisplay = `<div class="frontmatter-display"><p>Error displaying frontmatter.</p></div>`;
          }
        }
        
        const docTitle = currentFrontmatter?.title || currentFileName.replace(/\.[^/.]+$/, "");
        const proseStyles = getProseStylesForHtmlDownload(currentFileContent, currentFileName);

        fileContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${String(docTitle).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css" integrity="sha384-DotA7xyoLdKyHLyPgO8GjvGfZ0pUxfmQjLVEADgRUoGxTt5c679abek1xLDHDHdl" crossorigin="anonymous">
  <style>${proseStyles}</style>
</head>
<body>
  ${frontmatterHtmlDisplay}
  <div class="prose-styles">${renderedContentHtml}</div>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js" integrity="sha384-X/XCfMm41VSsqRNwNEgmNihQev5UVNL5e_S9fB_M2L92JtS/FjGgCqjS4p2V_M2B" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js" integrity="sha384-+VBxd3r6XgURPl3gWnCc1vT/SWgY1L2G0H8JjT/wR8G2x/eY8h3q_M/HfUeJ5eOQ" crossorigin="anonymous"
    onload="renderMathInElement(document.body, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\\\[', right: '\\\\]', display: true},
        {left: '\\\\(', right: '\\\\)', display: false}
      ],
      throwOnError : false
    });"></script>
</body>
</html>`;
        mimeType = 'text/html;charset=utf-8';
        fileExtension = 'html';
        break;
    }
    
    const filename = `${filenameBase || 'document'}.${fileExtension}`;
    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    displayNotification(`Download started as ${fileExtension.toUpperCase()}!`, "success");
    setIsDownloadDropdownOpen(false);
  };

  const handleConfirmDeleteNode = () => {
    if (nodeToDeleteInfo) {
      const newFsMap = deleteNodeFromStore(fileSystem, nodeToDeleteInfo.id);
      setFileSystem(newFsMap);
      displayNotification(`${nodeToDeleteInfo.type === 'file' ? 'File' : 'Folder'} "${nodeToDeleteInfo.name}" deleted.`, "success");

      if (activeFileId === nodeToDeleteInfo.id) {
        setActiveFileId(null);
        setMarkdownText(''); 
        const firstRemainingFile = Object.values(newFsMap).find(node => node.type === FileSystemNodeType.FILE) as FileNode | undefined;
        if (firstRemainingFile) {
            handleOpenFile(firstRemainingFile.id);
        }
      } else {
         if (activeFileId && !newFsMap[activeFileId]) {
            setActiveFileId(null);
            setMarkdownText('');
            const firstRemainingFile = Object.values(newFsMap).find(node => node.type === FileSystemNodeType.FILE) as FileNode | undefined;
            if (firstRemainingFile) {
                handleOpenFile(firstRemainingFile.id);
            }
         }
      }
    }
    setNodeToDeleteInfo(null);
    setIsDeleteNodeConfirmationOpen(false);
  };

  const handleCancelDeleteNode = () => {
    setNodeToDeleteInfo(null);
    setIsDeleteNodeConfirmationOpen(false);
    displayNotification("Deletion cancelled.", "info", 2000);
  };

  const toggleFileExplorer = () => {
    setIsFileExplorerVisible(prev => !prev);
  };

  // --- Conditional Returns for Page/Loading State ---
  if (currentPage === 'chat') {
    return (
      <ChatPage
        currentDocumentText={markdownText} 
        onApplyEdit={applyMarkieEditFromChat} 
        onNavigateBack={navigateToEditorPage}
        apiKeyExists={apiKeyExistsInitialCheck}
        pendingChatAction={pendingChatAction}
        onClearPendingChatAction={clearPendingChatAction}
        displayNotification={displayNotification}
        onFileSystemActionRequested={handleMarkieResponseActions}
        fileSystemMap={fileSystem}
        rootItemIds={rootItemIds}
      />
    );
  }
  
  if (isLoadingFileSystem) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-700">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-10 w-10 text-sky-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-lg font-medium">Loading Markie Editor...</p>
        </div>
      </div>
    );
  }

  // --- Render Logic ---
  const getNotificationStyles = (type: NotificationState['type']) => {
    switch (type) {
      case 'success': return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300', icon: <CheckCircleIcon className="w-5 h-5 mr-2 text-green-600" /> };
      case 'info': return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-300', icon: <InformationCircleIcon className="w-5 h-5 mr-2 text-sky-600" /> };
      case 'warning': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', icon: <ExclamationTriangleIcon className="w-5 h-5 mr-2 text-amber-600" /> };
      case 'error': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', icon: <XCircleIcon className="w-5 h-5 mr-2 text-red-600" /> };
      default: return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', icon: null };
    }
  };
  
  const baseButtonClass = "flex items-center px-3 py-1.5 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-white transition-colors duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed";
  const secondaryButtonClass = `${baseButtonClass} bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 focus:ring-sky-500`;
  const iconButtonClass = "p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-white focus:ring-sky-500 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed text-slate-500 hover:enabled:bg-slate-200 hover:enabled:text-slate-700";

  const activeFileIsEmpty = activeFileId ? (fileSystem[activeFileId] as FileNode)?.content === '' : true;

  return (
    <div className="h-screen flex flex-row bg-slate-200 text-slate-800 overflow-hidden">
      {/* File Explorer Panel */}
      {isFileExplorerVisible && (
        <div className="w-64 md:w-72 bg-slate-50 border-r border-slate-300 flex flex-col shadow-lg flex-shrink-0 transition-all duration-300 ease-in-out">
          <FileExplorer
            fileSystemMap={fileSystem}
            activeFileId={activeFileId}
            renamingNodeId={renamingNodeId}
            rootItemIds={rootItemIds}
            onOpenFile={handleOpenFile}
            onToggleFolder={handleToggleFolder}
            onCreateFile={(parentId) => handleCreateNode(FileSystemNodeType.FILE, parentId)}
            onCreateFolder={(parentId) => handleCreateNode(FileSystemNodeType.FOLDER, parentId)}
            onStartRename={handleStartRename}
            onConfirmRename={handleConfirmRename}
            onCancelRename={handleCancelRename}
            onUserProposeDelete={handleUserProposeDelete}
          />
        </div>
      )}
      
      {/* Main Content Panel */}
      <div className={`flex-grow flex flex-col bg-white shadow-inner overflow-hidden transition-all duration-300 ease-in-out ${isFileExplorerVisible ? 'ml-0' : 'ml-0 w-full'}`}>
        {/* Notification Area */}
        {notification && (
           <div
            key={notification.id}
            className={`
              fixed top-6 right-6 z-[100] w-auto max-w-md min-w-[320px]
              p-4 rounded-lg shadow-xl border
              text-sm font-medium flex items-center
              ${getNotificationStyles(notification.type).bg} 
              ${getNotificationStyles(notification.type).text} 
              ${getNotificationStyles(notification.type).border}
              transition-all duration-300 ease-out
              ${isNotificationVisible && currentPage === 'editor' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12 pointer-events-none'}
            `}
            role="alert"
          >
            {getNotificationStyles(notification.type).icon}
            <span className="flex-grow">{notification.message}</span>
            <button onClick={() => setIsNotificationVisible(false)} className="ml-2 p-1 rounded-md hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-current">
              <XCircleIcon className="w-4 h-4 opacity-70 hover:opacity-100" />
            </button>
          </div>
        )}

        {/* Header/Toolbar */}
        <header className="w-full p-3 md:p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center flex-shrink-0 space-x-2">
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button
              onClick={toggleFileExplorer}
              className={iconButtonClass}
              aria-label={isFileExplorerVisible ? "Hide File Explorer" : "Show File Explorer"}
              title={isFileExplorerVisible ? "Hide File Explorer" : "Show File Explorer"}
            >
              {isFileExplorerVisible ? <ChevronDoubleLeftIcon className="w-5 h-5" /> : <ChevronDoubleRightIcon className="w-5 h-5" />}
            </button>
            <AskMarkieButton onClick={navigateToChatPage} disabled={apiKeyExistsInitialCheck === false || !activeFileId} />
            {previousMarkdownTextForUndo && currentPage === 'editor' && activeFileId && (
              <button
                onClick={handleUndoLastAction}
                className={`${secondaryButtonClass} bg-amber-400 hover:bg-amber-500 text-amber-900 border-amber-500 focus:ring-amber-400`}
                aria-label="Undo last action"
                title="Undo last action"
              >
                <UndoIcon className="w-4 h-4 mr-1.5" />
                Undo
              </button>
            )}
             <button
                onClick={openClearConfirmation}
                className={iconButtonClass}
                aria-label="Clear active file content"
                title="Clear Active File"
                disabled={!activeFileId || activeFileIsEmpty}
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handleCopyDocument}
                className={iconButtonClass}
                aria-label="Copy active file content"
                title="Copy Active File"
                disabled={!activeFileId || activeFileIsEmpty}
              >
                <DocumentDuplicateIcon className="w-5 h-5" />
              </button>
              
              <div className="relative" ref={downloadDropdownRef}>
                <button
                  onClick={() => setIsDownloadDropdownOpen(prev => !prev)}
                  className={`${iconButtonClass} ${isDownloadDropdownOpen ? 'bg-slate-200 text-slate-700' : ''}`}
                  aria-label="Download active file options"
                  title="Download Active File"
                  aria-haspopup="true"
                  aria-expanded={isDownloadDropdownOpen}
                  disabled={!activeFileId || activeFileIsEmpty}
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  <ChevronDownIcon className="w-4 h-4 ml-0.5 opacity-70" />
                </button>
                {isDownloadDropdownOpen && (
                  <div 
                    className="absolute left-0 mt-2 w-48 bg-white border border-slate-300 rounded-md shadow-lg py-1 z-20"
                    role="menu"
                    aria-orientation="vertical"
                  >
                    {['md', 'html', 'txt', 'json'].map(format => (
                       <button
                        key={format}
                        onClick={() => handleDownloadDocument(format as DownloadFormat)}
                        className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-sky-600"
                        role="menuitem"
                      >
                        as {format.toUpperCase()} (.{format})
                      </button>
                    ))}
                  </div>
                )}
              </div>
          </div>
          <ModeToggleButton currentMode={mode} onToggle={handleToggleMode} disabled={!activeFileId} />
        </header>

        {/* Editor/Viewer Content */}
        <main className="w-full flex-grow flex flex-col relative p-4 md:p-6 overflow-y-auto">
          {!activeFileId && (
            <div className="flex-grow flex flex-col items-center justify-center text-slate-500 text-lg p-8 rounded-lg bg-slate-50">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-16 h-16 text-slate-400 mb-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <p className="font-medium">No file selected.</p>
              <p className="text-sm text-slate-400 mt-1">Select a file from the explorer or create a new one to begin.</p>
            </div>
          )}
          {activeFileId && mode === EditorMode.EDIT && (
            <Editor 
              text={markdownText} 
              onTextChange={handleTextChangeInEditor}
              isEditMode={mode === EditorMode.EDIT}
            />
          )}
          {activeFileId && mode === EditorMode.VIEW && (
            <Viewer frontmatterData={parsedFrontmatter} contentMarkdown={contentMarkdownBody} />
          )}
        </main>

        {/* Footer */}
        <footer className="w-full p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex-shrink-0">
          <div className="flex justify-between items-center">
            <span className="truncate max-w-[calc(100%-220px)] font-medium">
              {activeFileId && fileSystem[activeFileId] ? `File: ${fileSystem[activeFileId].name}` : 'No file open'}
            </span>
            <div className="flex space-x-3">
              <span>Chars: {charCount}</span>
              <span>Words: {wordCount}</span>
            </div>
          </div>
        </footer>
      </div>

      <NameInputModal
        isOpen={isNameInputModalOpen}
        nodeType={nameInputModalConfig?.type || null}
        title={nameInputModalConfig?.type === FileSystemNodeType.FILE ? "Create New File" : "Create New Folder"}
        promptText={nameInputModalConfig?.type === FileSystemNodeType.FILE ? "Enter file name (e.g., notes.md):" : "Enter folder name:"}
        onConfirm={handleConfirmNameInputForNodeCreation}
        onCancel={handleCancelNameInputModal}
      />

      <ConfirmationModal
        isOpen={isClearConfirmationOpen}
        title="Confirm Clear Content"
        message={`Are you sure you want to clear all content of "${activeFileId && fileSystem[activeFileId] ? fileSystem[activeFileId].name : 'the active file'}"? This can be undone.`}
        onConfirm={handleConfirmClearEditor}
        onCancel={closeClearConfirmation}
        confirmText="Clear All"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
      />
      <ConfirmationModal
        isOpen={isDeleteNodeConfirmationOpen}
        title={`Confirm Delete ${nodeToDeleteInfo?.type === 'file' ? 'File' : 'Folder'}`}
        message={`Delete "${nodeToDeleteInfo?.name || ''}"? ${nodeToDeleteInfo?.type === 'folder' ? 'All contents will also be deleted. ' : ''}This action cannot be undone.`}
        onConfirm={handleConfirmDeleteNode}
        onCancel={handleCancelDeleteNode}
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
      />
    </div>
  );
};

export default App;
