

export enum EditorMode {
  VIEW = 'VIEW',
  EDIT = 'EDIT',
}

export enum ChatParticipant {
  USER = 'USER',
  MARKIE = 'MARKIE',
  ERROR = 'ERROR',
}

export interface GroundingChunk {
  web?: {
    uri?: string; 
    title?: string; 
  };
}

export interface ChatMessage {
  id: string;
  participant: ChatParticipant;
  text: string; 
  isStreaming?: boolean;
  timestamp: number;
  groundingSources?: GroundingChunk[];
  suggestions?: string[]; 
  systemActionFeedback?: string[];
  isEditProposal?: boolean; 
  proposedDocContent?: string | null; 
}

export interface UserPreferences {
  rememberedFacts: Record<string, string>;
}

// --- File System Types ---
export enum FileSystemNodeType {
  FILE = 'FILE',
  FOLDER = 'FOLDER',
}

export interface BaseNode {
  id: string;
  name: string;
  parentId: string | null; // null for root items
  type: FileSystemNodeType;
}

export interface FileNode extends BaseNode {
  type: FileSystemNodeType.FILE;
  content: string;
}

export interface FolderNode extends BaseNode {
  type: FileSystemNodeType.FOLDER;
  childrenIds: string[];
  isExpanded?: boolean; 
}

export type FileSystemNode = FileNode | FolderNode;

export type FileSystemMap = Record<string, FileSystemNode>;

// --- Markie File System Action Types ---
export enum MarkieFileSystemActionType {
  CREATE_FILE = 'CREATE_FILE',
  CREATE_FOLDER = 'CREATE_FOLDER',
  PROPOSE_DELETE = 'PROPOSE_DELETE',
  NAVIGATE_TO_FILE = 'NAVIGATE_TO_FILE',
  READ_FILE_CONTENT = 'READ_FILE_CONTENT', 
  // Future: RENAME_NODE, MOVE_NODE
}

export interface CreateFilePayload {
  parentId: string | null;
  fileName: string;
  initialContent?: string;
}

export interface CreateFolderPayload {
  parentId: string | null;
  folderName: string;
}

export interface ProposeDeletePayload {
  nodeId: string;
  nodeName: string; // For confirmation dialog
}

export interface NavigateToFilePayload {
  fileId: string;
}

export interface ReadFileContentPayload { 
  fileId: string;
}

export type MarkieFileSystemActionPayload = 
  | CreateFilePayload 
  | CreateFolderPayload 
  | ProposeDeletePayload 
  | NavigateToFilePayload
  | ReadFileContentPayload; 

export interface MarkieFileSystemAction {
  type: MarkieFileSystemActionType;
  payload: MarkieFileSystemActionPayload;
}

// --- Moved from App.tsx ---
export type FrontmatterData = Record<string, any> | null;

export interface NotificationState {
  id: string; 
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}
