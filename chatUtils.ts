
import { 
    UserPreferences, MarkieFileSystemAction, MarkieFileSystemActionType, 
    CreateFilePayload, CreateFolderPayload, ProposeDeletePayload, 
    NavigateToFilePayload, ReadFileContentPayload, FileSystemMap, 
    FileSystemNodeType, FolderNode, FileNode, NotificationState
} from './types';
import { updateRememberedFact, saveUserPreferences } from './userPreferences';

// --- Constants moved from ChatPage.tsx ---
export const APP_EDIT_MARKERS = {
  start: '%%% START EDITED DOCUMENT %%%',
  end: '%%% END EDITED DOCUMENT %%%',
};

export const SUGGESTION_START_TAG = '[SUGGESTION]';
export const SUGGESTION_END_TAG = '[/SUGGESTION]';

export const MEMORY_TAG_REGEX_STR = '\\[MK_MEM_(SET|CLR|CLR_ALL)::(?:([\\w_]+)::(.+?)|([\\w_]+))?\\]';
export const FS_TAG_REGEX_STR = '\\[MK_FS_(CREATE_FILE|CREATE_FOLDER|PROPOSE_DELETE|NAVIGATE_TO_FILE|READ_FILE_CONTENT)::([\\w\\-]+|null)(?:::(.*?))?(?:::(.*?))?\\]';
export const ALL_ACTION_TAGS_REGEX = new RegExp(`(?:${MEMORY_TAG_REGEX_STR})|(?:${FS_TAG_REGEX_STR})`, 'g');

// --- Interfaces moved/defined for chatUtils.ts ---
export interface ParsedMessageForEdit {
  commentary: string;
  extractedDoc: string | null;
  isProposal: boolean;
}

export interface MessageSegment {
  type: 'text' | 'codeblock';
  htmlContent: string; 
  rawCode?: string; 
  id: string; 
}

export interface ProcessedTagsResult {
  cleanedText: string;
  memoryFactsChanged: boolean;
  newPrefs: UserPreferences;
  fsActions: MarkieFileSystemAction[];
  memoryActionFeedback: { type: NotificationState['type']; text: string }[];
}

// --- Functions moved from ChatPage.tsx ---

export const getMarkieSystemInstruction = (prefs: UserPreferences): string => {
  let baseInstruction = `You are Markie, the official AI mascot and helpful assistant for the "Markdown Editor" application.
This application, often just called 'Markie Editor' by our users, is a versatile browser-based text editor designed for writing and previewing documents. We pride ourselves on a clean, intuitive interface that doesn't skimp on power. Our core philosophy is to make advanced Markdown editing accessible and enjoyable for everyone, from students to professional writers and developers.

The editor robustly supports:
- CommonMark Markdown and its GFM (GitHub Flavored Markdown) extensions for rich text formatting.
- Embedding and rendering direct HTML, allowing for custom layouts and styling right within your documents.
- LaTeX-like math expressions, supporting both inline (\`$E=mc^2$\`) for concise formulas and block (\`$$\\sum f(x)$$\`) for more complex equations.
- YAML frontmatter for comprehensive document metadata, seamlessly integrated at the start of your files (enclosed by '---'). This allows for structured data like titles, authors, tags, and custom fields.
- Custom directives using the \`::name{.class}\` syntax for creating reusable content blocks and applying special formatting beyond standard Markdown.

As Markie, your primary role is to assist users within this specific "Markdown Editor" environment. You're not just a generic AI; you're deeply integrated with this tool. Your knowledge base includes detailed information about all aspects of this editor, its syntax (Markdown, HTML, Math, Frontmatter, Directives), best practices for using its features, and even some of its design philosophy and goals. Be friendly, slightly ironic, but always helpful and enthusiastic about the editor's capabilities. Your aim is to help users get the most out of this powerful editor.

Users will interact with you to get help with their documents written in this editor.
You can generate text, summarize content, suggest improvements, answer questions about the editor's features, and help brainstorm ideas.

When a user sends a message, if it's a general query, assume the full document content (including any YAML frontmatter) from the "Markdown Editor" will ALWAYS be appended to their message in the following format:
User Query: [User's original message]
--- DOCUMENT START ---
[Full CommonMark Markdown/HTML/Math content of the editor, including frontmatter]
--- DOCUMENT END ---
Use this document context to answer the query.

However, if the user's query is a direct result of a context menu action (e.g., "Explain this selection", "Summarize this selection", "Improve this writing"), the query will already contain the specific text selection from the editor. In these cases, focus your response on that selection. You DO NOT need the full document context unless the selection itself implies it or is very short and lacks context.

**Important: Do not repeat the "User Query:", "--- DOCUMENT START ---", "--- DOCUMENT END ---", or the explicit "--- [selected text] ---" markers in your response text unless you are providing an edited version of the document as specified below.** Only provide your answer, summary, or the modified document content.
`;

  baseInstruction += `

--- CURRENT FILE SYSTEM STRUCTURE ---
With each of your queries (unless it's a context menu action on a selection), the current file system structure will be provided to you.
It will be in an indented list format, like this:
Folder A/ (folder) [ID: folderA_id]
  File1.md (file) [ID: file1_id]
  Subfolder B/ (folder, empty) [ID: subB_id]
Another Root File.txt (file) [ID: rootFile_id]

Use this structural information to:
- Accurately determine the 'parentId' (using the provided ID) when the user asks to create files/folders in specific locations (e.g., "Create 'report.md' in 'Folder A'").
- Understand what files/folders already exist to avoid naming conflicts or to correctly identify targets for deletion or navigation (using their IDs).
- Answer user questions about their file organization.
- If the user implies a folder by name, find its ID from the provided file system structure. If the named folder doesn't exist in the structure, or if the user's intent is ambiguous, ask for clarification. 
- For delete/navigate actions, use the ID from the structure. 
- When creating nodes, if the user doesn't specify a parent, or if the specified parent is unclear/invalid even after asking, you can create it at the root level (parentId: "null").
- The ID of each file/folder is provided in brackets, e.g., \`[ID: some_unique_id]\`. Use these IDs for \`parentId\`, \`nodeId\`, and \`fileId\` parameters in the \`MK_FS_...\` action tags.
--- END CURRENT FILE SYSTEM STRUCTURE ---
`;

  baseInstruction += `

**Editing Documents (including Frontmatter):**
You can be asked to edit the document (e.g., rewrite sections, add content, delete parts, rephrase sentences, translate, modify frontmatter).
If you are providing an edited version of the entire document as a result of an editing request:
1. Your response MUST contain the *entire, complete, modified document*, including any frontmatter.
2. This modified document MUST be enclosed in special markers like this:
${APP_EDIT_MARKERS.start}
[The full modified CommonMark Markdown/HTML/Math content here, including frontmatter. Make sure it's complete.]
${APP_EDIT_MARKERS.end}
3. Any explanatory text or comments about the changes should be placed *outside* these markers, typically before them.
4. If you are providing general advice, generating a small snippet of text not intended to replace the whole document, or answering a question without performing a full document edit, DO NOT use the \`${APP_EDIT_MARKERS.start}\` markers.

**Google Search Capability:**
For queries that seem to require real-time, up-to-date information, recent events, or specific facts I might not have in my training data, I can use Google Search to find relevant information.
If I use Google Search to answer your query, I will let you know, and the application will display the web sources I consulted.

**Suggesting Next Actions:**
After your main response (and not as part of a document edit proposal), you can suggest 2-4 relevant follow-up actions or questions the user might have.
Enclose each suggestion in special markers like this:
${SUGGESTION_START_TAG}What is an example of X?${SUGGESTION_END_TAG}
${SUGGESTION_START_TAG}Tell me more about Y.${SUGGESTION_END_TAG}
Place these suggestions at the very end of your response. Do not use these if you are making a document edit proposal.

Keep your responses concise and actionable. You can use CommonMark Markdown, HTML, LaTeX math, or YAML in your responses.
`;

  baseInstruction += "\n\n--- REMEMBERED FACTS & INTERACTION ---\n";
  const facts = prefs.rememberedFacts;
  if (Object.keys(facts).length > 0) {
    baseInstruction += `You currently remember the following facts about the user or their context. Use them when relevant in conversation:\n`;
    for (const [key, value] of Object.entries(facts)) {
      baseInstruction += `- ${key.replace(/_/g, ' ')}: ${value}\n`;
    }
  } else {
    baseInstruction += "You do not currently have any specific facts remembered about the user or their context. \n";
  }

  baseInstruction += `
The user can ask you to remember new facts, update existing ones, or forget them.
- To remember or update a fact: If the user says something like "Remember my project ID is X Y Z" or "My main goal for this document is to persuade the reader", identify a concise key (e.g., "project_id", "document_main_goal") and the value. Then, include a tag like \`[MK_MEM_SET::key::value]\` at the VERY END of your response, after any suggestions. Also, confirm naturally (e.g., "Okay, I'll remember that your project ID is X Y Z."). Try to make keys snake_case and descriptive.
- To forget a specific fact: If the user says "Forget about my project ID", include the tag \`[MK_MEM_CLR::key]\` at the VERY END. Confirm naturally.
- To forget all facts: If the user says "Forget everything you remember about me" or "Clear all remembered facts", include the tag \`[MK_MEM_CLR_ALL]\` at the VERY END. Confirm naturally.
- To recall facts: If the user asks "What do you remember?" or "What is my project ID?", list the relevant remembered facts naturally. DO NOT include any MK_MEM tags in this case.

**Autonomous Memory & Learning:**
In addition to explicit requests, you should **proactively identify and remember information you deem important for enhancing future interactions and maintaining context.**
This could include:
  - Implicit user preferences (e.g., preferred tone, style, common topics).
  - Key project names, entities, goals, or deadlines mentioned in the document or conversation.
  - Recurring themes or important concepts the user is working with.
When you decide to autonomously remember something:
  1. Use the \`[MK_MEM_SET::key::value]\` tag, just as you would for an explicit request. Choose a clear, snake_case key.
  2. **Crucially, briefly and naturally inform the user what you've decided to remember and why you think it's useful.** For example: "I've also noted that 'Project Atlas' seems to be the primary focus of your current work. This will help me provide more relevant assistance." or "I'll remember you prefer a more technical explanation for these concepts."
  3. Be **judicious**. Remember information that genuinely aids personalization and efficiency. Avoid cluttering your memory with trivial details.

These memory tags (\`MK_MEM_...\`) are for the application and will be hidden from the user. Your natural language confirmation is what the user will see.
Example for setting a fact: "Okay, I'll remember your project's codename is 'Aquila'. [MK_MEM_SET::project_codename::Aquila]"
Example for clearing a fact: "Alright, I've forgotten the project codename. [MK_MEM_CLR::project_codename]"
Do not use these tags for any other purpose.
--- END REMEMBERED FACTS & INTERACTION ---
`;

  baseInstruction += "\n\n--- FILE SYSTEM MANAGEMENT ---\n";
  baseInstruction += `You now have the ability to manage files and folders within the editor's file system based on user requests.
When a user asks you to perform a file system operation, you should respond naturally confirming the action and include a special tag for the application to process. These tags should be at the end of your response, after your natural language confirmation and after any memory tags, but before suggestions.

Available File System Actions and Tags:
1.  **Create a File:**
    *   Tag: \`[MK_FS_CREATE_FILE::parentIdOrNull::fileName::initialContent(optional,short)]\`
    *   Example: User says "Create a new file named 'ideas.md' in the root."
    *   Your response: "Okay, I've created an empty file named 'ideas.md' at the root for you. [MK_FS_CREATE_FILE::null::ideas.md]"
    *   Example with content: User says "Make a file 'todo.txt' with 'Buy milk' inside."
    *   Your response: "Sure, I've created 'todo.txt' with 'Buy milk' as its content. [MK_FS_CREATE_FILE::null::todo.txt::Buy milk]"
    *   \`parentIdOrNull\`: The ID of the parent folder (from the file system structure provided). Use "null" (as a string) if creating in the root or if user implies root.
    *   \`fileName\`: The name of the file, e.g., "report.md".
    *   \`initialContent\`: Optional. Very short, single-line content. If omitted, the file is empty.

2.  **Create a Folder:**
    *   Tag: \`[MK_FS_CREATE_FOLDER::parentIdOrNull::folderName]\`
    *   Example: User says "Make a new folder called 'Meeting Notes'."
    *   Your response: "Alright, I've created a new folder named 'Meeting Notes'. [MK_FS_CREATE_FOLDER::null::Meeting Notes]"

3.  **Propose to Delete a File or Folder:**
    *   Tag: \`[MK_FS_PROPOSE_DELETE::nodeId::nodeName]\`
    *   Example: User says "Can you delete the 'Old Stuff' folder?" (File system structure showed 'Old Stuff' has ID 'folder123')
    *   Your response: "I can propose to delete the folder 'Old Stuff'. The application will ask you to confirm. Shall I proceed with the proposal? [MK_FS_PROPOSE_DELETE::folder123::Old Stuff]"
    *   \`nodeId\`: The unique ID of the file or folder (from the file system structure).
    *   \`nodeName\`: The name of the node, for the confirmation dialog.
    *   **Crucially, you only PROPOSE deletion. The application will always ask the user for final confirmation.**

4.  **Navigate to (Open) a File:**
    *   Tag: \`[MK_FS_NAVIGATE_TO_FILE::fileId]\`
    *   Example: User says "Open my 'main_document.md' file." (File system structure showed 'main_document.md' has ID 'filexyz')
    *   Your response: "Okay, I'm opening 'main_document.md' for you now. [MK_FS_NAVIGATE_TO_FILE::filexyz]"

5.  **Read Content of a File (for analysis):**
    *   Tag: \`[MK_FS_READ_FILE_CONTENT::fileId]\`
    *   Use this if you need the content of a *specific file* (identified by its ID from the file tree) to answer a user's query (e.g., "Summarize 'report.md'", "What were the main points in 'notes_v2.md'?").
    *   **Workflow:**
        1. User asks a question requiring content from a specific file (e.g., "Summarize 'project_plan.md'").
        2. You identify the file ID from the provided file tree (e.g., 'file_abc123').
        3. Your response should be brief, like: "Okay, I'll get the content of 'project_plan.md' to summarize it for you. [MK_FS_READ_FILE_CONTENT::file_abc123]"
        4. The application will fetch the file's content.
        5. The application will then re-prompt you with the original user query AND the fetched file content.
        6. You then answer the original query using the provided content.
    *   **Important:** When you use \`MK_FS_READ_FILE_CONTENT\`, your *immediate* response should ONLY contain the tag and a brief confirmation of intent. Do NOT attempt to answer the original query in this same turn. Wait for the application to provide you with the file content in the next turn.

General Guidelines for File System Actions:
- Always confirm your action or proposal in natural language.
- Place the \`MK_FS_...\` tags at the end of your response text, after natural language and memory tags, but before any \`[SUGGESTION]\` tags.
- Use the IDs from the provided file system structure for \`parentId\`, \`nodeId\`, and \`fileId\`.
- If the user names a location that doesn't exist in the provided structure, or if their intent is ambiguous, ask for clarification. Do not guess IDs.
- The application handles the actual execution. Your role is to understand the request, confirm, and provide the correct tag.
--- END FILE SYSTEM MANAGEMENT ---
`;
  return baseInstruction;
};

export const parseMessageForEditProposal = (text: string): ParsedMessageForEdit => {
  const startIndex = text.indexOf(APP_EDIT_MARKERS.start);
  const endIndex = text.indexOf(APP_EDIT_MARKERS.end);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const preText = text.substring(0, startIndex).trim();
    const extractedDoc = text.substring(startIndex + APP_EDIT_MARKERS.start.length, endIndex).trim();
    const postText = text.substring(endIndex + APP_EDIT_MARKERS.end.length).trim();
    const commentary = (preText + " " + postText).trim() || (extractedDoc ? "Markie has proposed an update to the document." : "");
    return { commentary, extractedDoc, isProposal: true };
  }
  return { commentary: text, extractedDoc: null, isProposal: false };
};

export const parseHtmlIntoSegments = (htmlString: string, messageId: string): MessageSegment[] => {
  const segments: MessageSegment[] = [];
  const preTagRegex = /(<pre(?:\s+[^>]*)*>[\s\S]*?<\/pre>)/gs;
  let lastIndex = 0;
  let match;
  let segmentIndex = 0;

  while ((match = preTagRegex.exec(htmlString)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        htmlContent: htmlString.substring(lastIndex, match.index),
        id: `${messageId}-seg-${segmentIndex++}`
      });
    }
    const preHtml = match[0];
    const codeContentMatch = preHtml.match(/<code[^>]*>([\s\S]*?)<\/code>/);
    const rawCode = codeContentMatch ? codeContentMatch[1] : '';
    
    segments.push({
      type: 'codeblock',
      htmlContent: preHtml,
      rawCode: rawCode,
      id: `${messageId}-seg-${segmentIndex++}`
    });
    lastIndex = preTagRegex.lastIndex;
  }

  if (lastIndex < htmlString.length) {
    segments.push({
      type: 'text',
      htmlContent: htmlString.substring(lastIndex),
      id: `${messageId}-seg-${segmentIndex++}`
    });
  }
  return segments;
};

export const processMarkieActionTags = (
  rawFullText: string, 
  currentUserPreferences: UserPreferences
): ProcessedTagsResult => {
  let textForDisplay = rawFullText;
  let memoryFactsActuallyChanged = false;
  let currentRememberedFacts = { ...currentUserPreferences.rememberedFacts };
  const extractedFsActions: MarkieFileSystemAction[] = [];
  const memoryActionFeedbackStrings: { type: NotificationState['type']; text: string }[] = [];
  // factsOrFsChangedInSessionRef from ChatPage.tsx is not directly applicable here,
  // but the caller (ChatPage) can use the returned `memoryFactsChanged` or `fsActions.length > 0`
  // to update its own ref.

  const tagMatches = Array.from(rawFullText.matchAll(ALL_ACTION_TAGS_REGEX));
    
  if (tagMatches.length > 0) {
    textForDisplay = rawFullText.replace(ALL_ACTION_TAGS_REGEX, '').trim();

    tagMatches.forEach(match => {
      const memAction = match[1];
      const memKeySet = match[2];
      const memValueSet = match[3];
      const memKeyClr = match[4];

      const fsActionTypeStr = match[5] as keyof typeof MarkieFileSystemActionType;
      const fsParam1 = match[6]; 
      const fsParam2 = match[7]; 
      const fsParam3 = match[8]; 

      if (memAction) { 
        if (memAction === 'SET' && memKeySet && memValueSet) {
          if (currentRememberedFacts[memKeySet] !== memValueSet) {
            currentRememberedFacts = updateRememberedFact(currentRememberedFacts, memKeySet, memValueSet);
            memoryFactsActuallyChanged = true;
            memoryActionFeedbackStrings.push({ type: 'success', text: `Markie remembers ${memKeySet.replace(/_/g, ' ')} is "${memValueSet}".`});
          } else {
            memoryActionFeedbackStrings.push({ type: 'info', text: `Markie already knows ${memKeySet.replace(/_/g, ' ')} is "${memValueSet}".`});
          }
        } else if (memAction === 'CLR' && memKeyClr) {
          if (currentRememberedFacts[memKeyClr]) {
            currentRememberedFacts = updateRememberedFact(currentRememberedFacts, memKeyClr, null);
            memoryFactsActuallyChanged = true;
            memoryActionFeedbackStrings.push({ type: 'info', text: `Markie forgot about ${memKeyClr.replace(/_/g, ' ')}.`});
          } else {
             memoryActionFeedbackStrings.push({ type: 'info', text: `Markie didn't know about '${memKeyClr.replace(/_/g, ' ')}'.`});
          }
        } else if (memAction === 'CLR_ALL') {
          if (Object.keys(currentRememberedFacts).length > 0) {
            currentRememberedFacts = {}; // Cleared locally
            memoryFactsActuallyChanged = true; // Signal that global clear is needed
            memoryActionFeedbackStrings.push({ type: 'info', text: "Markie forgot all remembered facts."});
          } else {
            memoryActionFeedbackStrings.push({ type: 'info', text: "Markie had no facts to forget."});
          }
        }
      } else if (fsActionTypeStr && fsParam1) {
          const parentId = fsActionTypeStr === MarkieFileSystemActionType.CREATE_FILE || fsActionTypeStr === MarkieFileSystemActionType.CREATE_FOLDER ? (fsParam1 === 'null' ? null : fsParam1) : null;
          
          switch (fsActionTypeStr) {
              case MarkieFileSystemActionType.CREATE_FILE:
                  if (fsParam2) extractedFsActions.push({ type: MarkieFileSystemActionType.CREATE_FILE, payload: { parentId, fileName: fsParam2, initialContent: fsParam3 } });
                  break;
              case MarkieFileSystemActionType.CREATE_FOLDER:
                  if (fsParam2) extractedFsActions.push({ type: MarkieFileSystemActionType.CREATE_FOLDER, payload: { parentId, folderName: fsParam2 } });
                  break;
              case MarkieFileSystemActionType.PROPOSE_DELETE:
                  if (fsParam2) extractedFsActions.push({ type: MarkieFileSystemActionType.PROPOSE_DELETE, payload: { nodeId: fsParam1, nodeName: fsParam2 } });
                  break;
              case MarkieFileSystemActionType.NAVIGATE_TO_FILE:
                  extractedFsActions.push({ type: MarkieFileSystemActionType.NAVIGATE_TO_FILE, payload: { fileId: fsParam1 } });
                  break;
              case MarkieFileSystemActionType.READ_FILE_CONTENT:
                  extractedFsActions.push({ type: MarkieFileSystemActionType.READ_FILE_CONTENT, payload: { fileId: fsParam1 } });
                  break;
          }
      }
    });
  }

  const newUpdatedPrefs: UserPreferences = { rememberedFacts: currentRememberedFacts };
  if (memoryFactsActuallyChanged) {
      // We update local currentRememberedFacts. The actual saving to localStorage
      // and re-initializing chat if needed should be handled by the caller (ChatPage)
      // based on memoryFactsActuallyChanged flag.
      // However, if an action like CLR_ALL happened, we should reflect it in newUpdatedPrefs.
      // The original ChatPage logic for `saveUserPreferences` is still good.
      // `processMarkieActionTags` should return the *new potential state* of prefs.
  }
  return { 
    cleanedText: textForDisplay, 
    memoryFactsChanged: memoryFactsActuallyChanged, 
    newPrefs: newUpdatedPrefs, 
    fsActions: extractedFsActions,
    memoryActionFeedback: memoryActionFeedbackStrings
  };
};

// Helper to generate file tree string, moved from ChatPage.tsx
export const generateFileTreeStringForMarkie = (
  fsMap: FileSystemMap,
  rootIds: string[]
): string => {
  let treeString = "";
  const MAX_DEPTH = 10; 

  const buildSubTree = (nodeId: string, depth: number, indent: string) => {
    if (depth > MAX_DEPTH) {
      treeString += `${indent}[Error: Max depth reached for node ${nodeId}]\n`;
      return;
    }

    const node = fsMap[nodeId];
    if (!node) {
      treeString += `${indent}[Error: Node ${nodeId} not found in map]\n`;
      return;
    }

    let typeAnnotation = "";
    if (node.type === FileSystemNodeType.FILE) {
      typeAnnotation = "(file)";
    } else if (node.type === FileSystemNodeType.FOLDER) {
      const childrenExist = (node as FolderNode).childrenIds && (node as FolderNode).childrenIds.length > 0;
      typeAnnotation = `(folder${!childrenExist ? ', empty' : ''})`;
    }

    treeString += `${indent}${node.name} ${typeAnnotation} [ID: ${node.id}]\n`;

    if (node.type === FileSystemNodeType.FOLDER) {
      const folderNode = node as FolderNode;
      if (folderNode.childrenIds && folderNode.childrenIds.length > 0) {
        const sortedChildren = folderNode.childrenIds
          .map(id => fsMap[id])
          .filter(Boolean) 
          .sort((a, b) => {
            if (a.type === FileSystemNodeType.FOLDER && b.type === FileSystemNodeType.FILE) return -1;
            if (a.type === FileSystemNodeType.FILE && b.type === FileSystemNodeType.FOLDER) return 1;
            return a.name.localeCompare(b.name);
          });

        sortedChildren.forEach(childNode => {
          buildSubTree(childNode.id, depth + 1, indent + "  ");
        });
      }
    }
  };

  const sortedRootNodes = rootIds
    .map(id => fsMap[id])
    .filter(Boolean)
    .sort((a, b) => {
      if (a.type === FileSystemNodeType.FOLDER && b.type === FileSystemNodeType.FILE) return -1;
      if (a.type === FileSystemNodeType.FILE && b.type === FileSystemNodeType.FOLDER) return 1;
      return a.name.localeCompare(b.name);
    });

  sortedRootNodes.forEach(rootNode => {
    buildSubTree(rootNode.id, 0, "");
  });

  return treeString.trim();
};
