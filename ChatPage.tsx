
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { 
    ChatMessage, ChatParticipant, GroundingChunk, UserPreferences, MarkieFileSystemAction, 
    FileSystemMap, FileSystemNode, FileSystemNodeType, FolderNode, NotificationState, MarkieFileSystemActionType // Added NotificationState and MarkieFileSystemActionType
} from './types';
import { GoogleGenAI, Chat } from "@google/genai";
import { SendIcon, CopyIcon, ChatBubbleIcon, CheckCircleIcon, XCircleIcon, DocumentDuplicateIcon, ArrowLeftIcon, UserIcon, TrashIcon, StopCircleIcon, ArrowLongDownIcon, ChatBubbleLeftRightIcon, ClipboardDocumentIcon, XMarkIcon, AdjustmentsHorizontalIcon, EyeIcon } from './components/Icons';
import ConfirmationModal from './components/ConfirmationModal'; 
import DiffViewerModal from './components/DiffViewerModal'; 
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';
import type { PendingChatAction } from './App'; 
import { loadUserPreferences, saveUserPreferences, updateRememberedFact, clearAllRememberedFacts } from './userPreferences';
import {
    getMarkieSystemInstruction,
    parseMessageForEditProposal,
    parseHtmlIntoSegments,
    processMarkieActionTags,
    generateFileTreeStringForMarkie, // Renamed for clarity
    APP_EDIT_MARKERS, // Import necessary constants
    SUGGESTION_START_TAG,
    SUGGESTION_END_TAG
} from './chatUtils'; // Import from new chatUtils.ts
import type { 
    ParsedMessageForEdit, 
    MessageSegment, 
    ProcessedTagsResult 
} from './chatUtils'; // Import types from chatUtils if they are exported


// generateFileTreeString moved to chatUtils.ts and renamed to generateFileTreeStringForMarkie
// getMarkieSystemInstruction moved to chatUtils.ts
// APP_EDIT_MARKERS moved to chatUtils.ts
// SUGGESTION_START_TAG, SUGGESTION_END_TAG moved to chatUtils.ts
// MEMORY_TAG_REGEX_STR, FS_TAG_REGEX_STR, ALL_ACTION_TAGS_REGEX moved to chatUtils.ts
// ParsedMessageForEdit, MessageSegment, ProcessedTagsResult types will be imported from chatUtils or defined there if not exported.
// parseMessageForEditProposal moved to chatUtils.ts
// parseHtmlIntoSegments moved to chatUtils.ts
// processMarkieActionTags moved to chatUtils.ts


interface ChatPageProps {
  currentDocumentText: string;
  onApplyEdit: (editedText: string, messageId: string) => void;
  onNavigateBack: () => void;
  apiKeyExists: boolean | null;
  pendingChatAction: PendingChatAction | null;
  onClearPendingChatAction: () => void;
  displayNotification: (message: string, type: NotificationState['type'], duration?: number) => void;
  onFileSystemActionRequested: (actions: MarkieFileSystemAction[], updatedPrefs: UserPreferences, originalUserQuery?: string) => void;
  fileSystemMap: FileSystemMap; 
  rootItemIds: string[];
}


const ChatPage: React.FC<ChatPageProps> = ({
  currentDocumentText,
  onApplyEdit,
  onNavigateBack,
  apiKeyExists: apiKeyAvailable,
  pendingChatAction,
  onClearPendingChatAction,
  displayNotification,
  onFileSystemActionRequested,
  fileSystemMap, 
  rootItemIds,
}) => {
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(loadUserPreferences());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isMarkieTyping, setIsMarkieTyping] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [proposalStatus, setProposalStatus] = useState<Record<string, 'applied' | 'discarded' | null>>({});
  const [internalApiKeyExists, setInternalApiKeyExists] = useState<boolean | null>(apiKeyAvailable);
  const [isClearChatModalOpen, setIsClearChatModalOpen] = useState(false);
  const [clearFactsCheckbox, setClearFactsCheckbox] = useState(false); 
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [diffModalContent, setDiffModalContent] = useState<{ original: string; new: string } | null>(null);


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentAbortControllerRef = useRef<AbortController | null>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const factsOrFsChangedInSessionRef = useRef(false);
  const currentOriginalUserQueryRef = useRef<string | null>(null);


  const ai = useMemo(() => {
    if (process.env.API_KEY) {
      try {
        const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
        setInternalApiKeyExists(true);
        return genAI;
      } catch (error) {
        console.error("Failed to initialize GoogleGenAI in ChatPage:", error);
        setInternalApiKeyExists(false);
        return null;
      }
    }
    setInternalApiKeyExists(false);
    return null;
  }, []);

  const markieChatRef = useRef<Chat | null>(null);
  
  const addUiMessage = useCallback((participant: ChatParticipant, text: string, isStreaming = false, customId?: string, groundingSources?: GroundingChunk[], suggestions?: string[], isEditProposal?: boolean, proposedDocContent?: string | null): string => {
    const newMessageId = customId || crypto.randomUUID();
    setChatMessages(prev => {
        if (participant === ChatParticipant.ERROR && prev.some(msg => msg.participant === ChatParticipant.ERROR && msg.text === text)) {
            return prev; 
        }
        if (customId === 'welcome-message' && (prev.length > 0 || isMarkieTyping || pendingChatAction)) return prev;

        return [...prev, { 
            id: newMessageId, 
            participant, 
            text, 
            isStreaming, 
            timestamp: Date.now(), 
            groundingSources, 
            suggestions,
            isEditProposal, // Added
            proposedDocContent // Added
        }];
    });
    return newMessageId;
  }, [isMarkieTyping, pendingChatAction]); 

  const initializeChat = useCallback((prefsToUse: UserPreferences, currentSessionMessages: ChatMessage[]) => {
    if (ai && internalApiKeyExists) {
      try {
        const systemInstruction = getMarkieSystemInstruction(prefsToUse);
        
        const formattedHistoryForApi = currentSessionMessages
          .filter(msg => (msg.participant === ChatParticipant.USER || msg.participant === ChatParticipant.MARKIE) && !msg.isStreaming && msg.text.trim() !== '')
          .map(msg => ({
            role: msg.participant === ChatParticipant.USER ? 'user' : 'model',
            parts: [{ text: msg.text }] 
          }));

        const newChat = ai.chats.create({
          model: 'gemini-2.5-flash-preview-04-17',
          config: {
            systemInstruction: systemInstruction,
            tools: [{ googleSearch: {} }],
          },
          history: formattedHistoryForApi,
        });
        markieChatRef.current = newChat;
        console.log("Markie chat initialized/re-initialized. System Instruction Length:", systemInstruction.length, "History items:", formattedHistoryForApi.length);
        factsOrFsChangedInSessionRef.current = false; 
        return true;
      } catch (error) {
         console.error("Failed to create Markie chat on ChatPage:", error);
         setInternalApiKeyExists(false);
         addUiMessage(ChatParticipant.ERROR, `Failed to initialize Markie: ${error instanceof Error ? error.message : String(error)}`);
         return false;
      }
    }
    return false;
  }, [ai, internalApiKeyExists, addUiMessage]); 
  
  useEffect(() => {
    initializeChat(userPreferences, chatMessages);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const displayWelcomeMessageCallback = useCallback(() => {
    if (internalApiKeyExists && chatMessages.length === 0 && !isMarkieTyping && !pendingChatAction) {
       const welcomeTimeout = setTimeout(() => {
        let welcomeText = "Hello! I'm Markie, your Markdown assistant. How can I help with your document today?";
        if (userPreferences.rememberedFacts && Object.keys(userPreferences.rememberedFacts).length > 0) {
            welcomeText += " I remember some facts you've told me. Ask what I recall if you're curious!";
        }
        addUiMessage(ChatParticipant.MARKIE, welcomeText, false, 'welcome-message');
      }, 100);
      return () => clearTimeout(welcomeTimeout);
    }
  },[internalApiKeyExists, chatMessages.length, isMarkieTyping, addUiMessage, pendingChatAction, userPreferences.rememberedFacts]);


  useEffect(() => {
    if (pendingChatAction && internalApiKeyExists && markieChatRef.current) {
      performSendMessage(pendingChatAction.prompt, pendingChatAction.isInternalReprompt); 
      onClearPendingChatAction();
    } else if (!pendingChatAction && chatMessages.length === 0) { 
      displayWelcomeMessageCallback();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChatAction, internalApiKeyExists, onClearPendingChatAction, displayWelcomeMessageCallback]); 


  useEffect(() => {
    if (!userScrolledUp) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    if (internalApiKeyExists) {
      inputRef.current?.focus();
    }
  }, [chatMessages, internalApiKeyExists, userScrolledUp]);

  useEffect(() => {
    if (internalApiKeyExists) {
        inputRef.current?.focus();
    }
  }, [internalApiKeyExists]);

  useEffect(() => {
    if (userPreferences.rememberedFacts) { 
        factsOrFsChangedInSessionRef.current = true;
    }
  }, [userPreferences.rememberedFacts]);

  const updateMarkieMessageStream = (messageId: string, chunkText: string) => {
    setChatMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, text: msg.text + chunkText, isStreaming: true } : msg
    ));
  };
  

  const finalizeMarkieMessageStream = (messageId: string, rawFullText: string, groundingSources?: GroundingChunk[], stoppedByUser = false) => {
    const { 
      cleanedText, 
      memoryFactsChanged, 
      newPrefs, 
      fsActions, 
      memoryActionFeedback 
    } = processMarkieActionTags(rawFullText, userPreferences); // Pass current userPreferences
    
    let parsedSuggestions: string[] = [];
    let finalUiTextForBubble: string;
    const systemActionFeedbackForBubble: string[] = [];

    memoryActionFeedback.forEach(feedback => systemActionFeedbackForBubble.push(`Memory: ${feedback.text}`));

    fsActions.forEach(action => {
      // This part remains the same as it's about UI feedback based on fsActions
      const payload = action.payload as any; // Simplified for brevity
      switch (action.type) {
        case MarkieFileSystemActionType.CREATE_FILE:
          systemActionFeedbackForBubble.push(`File System: Will attempt to create file '${payload.fileName}'.`);
          break;
        case MarkieFileSystemActionType.CREATE_FOLDER:
          systemActionFeedbackForBubble.push(`File System: Will attempt to create folder '${payload.folderName}'.`);
          break;
        case MarkieFileSystemActionType.PROPOSE_DELETE:
          systemActionFeedbackForBubble.push(`File System: Will propose deletion of '${payload.nodeName}'.`);
          break;
        case MarkieFileSystemActionType.NAVIGATE_TO_FILE:
          systemActionFeedbackForBubble.push(`File System: Will attempt to open file (ID: ${payload.fileId}).`);
          break;
        case MarkieFileSystemActionType.READ_FILE_CONTENT:
          const fileToReadId = payload.fileId;
          const fileNameToRead = fileSystemMap[fileToReadId]?.name || fileToReadId;
          systemActionFeedbackForBubble.push(`File System: Will attempt to read file '${fileNameToRead}'.`);
          break;
      }
    });

    const editProposalCheck = parseMessageForEditProposal(cleanedText); 
    
    if (editProposalCheck.isProposal) {
        finalUiTextForBubble = editProposalCheck.commentary;
    } else {
        finalUiTextForBubble = cleanedText;
        const suggestionRegex = new RegExp(
            `${SUGGESTION_START_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.*?)${SUGGESTION_END_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
            'g'
        );
        let match;
        const suggestionsFound: string[] = [];
        
        let textBeforeSuggestions = finalUiTextForBubble;
        const firstSuggestionMatch = finalUiTextForBubble.match(suggestionRegex);

        if (firstSuggestionMatch) { 
            textBeforeSuggestions = finalUiTextForBubble.substring(0, finalUiTextForBubble.indexOf(firstSuggestionMatch[0])).trim();
        }

        while ((match = suggestionRegex.exec(finalUiTextForBubble)) !== null) {
            suggestionsFound.push(match[1].trim());
        }
        parsedSuggestions = suggestionsFound;
        finalUiTextForBubble = textBeforeSuggestions; // Update bubble text to exclude suggestions
    }

    setChatMessages(prevMessages => {
      const updatedMessages = prevMessages.map(msg =>
          msg.id === messageId ? { 
              ...msg, 
              text: finalUiTextForBubble + (stoppedByUser ? " (Stopped by user)" : ""), 
              isStreaming: false, 
              groundingSources,
              suggestions: parsedSuggestions.length > 0 ? parsedSuggestions : undefined,
              systemActionFeedback: systemActionFeedbackForBubble.length > 0 ? systemActionFeedbackForBubble : undefined,
              isEditProposal: editProposalCheck.isProposal, 
              proposedDocContent: editProposalCheck.extractedDoc, 
          } : msg
      );
      
      if (memoryFactsChanged) { 
        setUserPreferences(newPrefs); // newPrefs is from processMarkieActionTags
        saveUserPreferences(newPrefs); // Save to localStorage
        initializeChat(newPrefs, updatedMessages); 
      }
      return updatedMessages;
    });

    memoryActionFeedback.forEach(feedback => displayNotification(feedback.text, feedback.type, 4000));

    if (fsActions.length > 0) {
        onFileSystemActionRequested(fsActions, newPrefs, currentOriginalUserQueryRef.current || undefined);
    }
    currentOriginalUserQueryRef.current = null; 
  };

  const performSendMessage = useCallback(async (messageText: string, isInternalReprompt: boolean = false) => {
    if (!messageText.trim() || isMarkieTyping || !markieChatRef.current) {
        if(!markieChatRef.current && internalApiKeyExists){
            console.warn("Markie chat reference not available. Attempting to reinitialize.");
            if (!initializeChat(userPreferences, chatMessages)) return; 
        } else if (isMarkieTyping) {
            return; 
        } else {
            return; 
        }
    }
    
    if (!isInternalReprompt) {
        currentOriginalUserQueryRef.current = messageText;
        addUiMessage(ChatParticipant.USER, messageText);
    }
    const messagesForHistory = [...chatMessages, { id: crypto.randomUUID(), participant: ChatParticipant.USER, text: messageText, timestamp: Date.now() }];


    setIsMarkieTyping(true);
    setChatMessages(prev => prev.filter(msg => msg.id !== 'welcome-message'));

    let prompt: string;
    if (isInternalReprompt) {
        prompt = messageText; 
    } else if (messageText.includes('---') && (messageText.includes('Explain the following selection') || messageText.includes('Improve the writing') || messageText.includes('Summarize the following selection'))) {
        prompt = messageText;
    } else {
        prompt = `User Query: ${messageText}\n\n--- DOCUMENT START ---\n${currentDocumentText}\n--- DOCUMENT END ---`;
        if (fileSystemMap && rootItemIds) {
          const fileTreeString = generateFileTreeStringForMarkie(fileSystemMap, rootItemIds); // Use renamed util
          if (fileTreeString) {
            prompt += `\n\n--- FILE SYSTEM START ---\n${fileTreeString}\n--- FILE SYSTEM END ---`;
          }
        }
    }
    
    const markieMessageId = addUiMessage(ChatParticipant.MARKIE, '', true);
    let accumulatedGroundingSources: GroundingChunk[] | undefined = undefined;
    let accumulatedRawText = ""; 

    currentAbortControllerRef.current = new AbortController();
    const signal = currentAbortControllerRef.current.signal;

    try {
      if (!markieChatRef.current || factsOrFsChangedInSessionRef.current) {
          initializeChat(userPreferences, messagesForHistory); 
      }

      const stream = await markieChatRef.current.sendMessageStream({ message: prompt });
      for await (const chunk of stream) {
        if (signal.aborted) throw new DOMException("Aborted by user", "AbortError");
        const text = chunk.text;
        if (typeof text === 'string') {
            accumulatedRawText += text;
            updateMarkieMessageStream(markieMessageId, text); 
        }
        const currentChunkGrounding = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (currentChunkGrounding && currentChunkGrounding.length > 0) {
            if (!accumulatedGroundingSources) accumulatedGroundingSources = [];
            currentChunkGrounding.forEach(newSource => {
              if (newSource.web && !accumulatedGroundingSources!.some(s => s.web?.uri === newSource.web!.uri)) {
                accumulatedGroundingSources!.push(newSource);
              }
            });
          }
      }
      finalizeMarkieMessageStream(markieMessageId, accumulatedRawText, accumulatedGroundingSources);
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            console.log("Message generation stopped by user.");
            finalizeMarkieMessageStream(markieMessageId, accumulatedRawText, accumulatedGroundingSources, true);
        } else {
            console.error("Error sending message to Markie:", error);
            const errorText = `Markie couldn't respond: ${error instanceof Error ? error.message : String(error)}`;
            
            setChatMessages(prev => prev.map(msg =>
                msg.id === markieMessageId
                ? { ...msg, text: errorText, participant: ChatParticipant.ERROR, isStreaming: false }
                : msg
            ));
        }
    } finally {
      setIsMarkieTyping(false);
      currentAbortControllerRef.current = null;
    }
  }, [isMarkieTyping, internalApiKeyExists, currentDocumentText, addUiMessage, initializeChat, userPreferences, chatMessages, displayNotification, onFileSystemActionRequested, fileSystemMap, rootItemIds]);


  const handleFormSubmit = () => {
    if (userInput.trim()) {
      performSendMessage(userInput, false);
      setUserInput('');
    }
  };

  const handleStopGeneration = () => {
    if (currentAbortControllerRef.current) {
      currentAbortControllerRef.current.abort();
    }
    setIsMarkieTyping(false); 
  };


  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (userInput.trim() && internalApiKeyExists && !isMarkieTyping) {
        handleFormSubmit();
      }
    }
  };

  const handleCopyToClipboard = (textToCopy: string, id: string) => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedStates(prev => ({ ...prev, [id]: true }));
      displayNotification("Copied to clipboard!", "success", 1500);
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [id]: false }));
      }, 2000);
    }).catch(err => {
        console.error("Failed to copy: ", err);
        displayNotification("Failed to copy.", "error", 2000);
    });
  };

  const handleApplyProposal = (doc: string, messageId: string) => {
    onApplyEdit(doc, messageId);
    setProposalStatus(prev => ({...prev, [messageId]: 'applied'}));
  };

  const handleDiscardProposal = (messageId: string) => {
    setProposalStatus(prev => ({...prev, [messageId]: 'discarded'}));
     const discardInfoMsg = `[Document edit proposal discarded. You can ask Markie to try again if needed.]`;
     addUiMessage(ChatParticipant.MARKIE, discardInfoMsg, false, messageId + "-discarded-info");
  };

  const handleViewChanges = (proposedDocContent: string) => {
    setDiffModalContent({ original: currentDocumentText, new: proposedDocContent });
    setIsDiffModalOpen(true);
  };
  
  const handleQuoteMessage = (textToQuote: string, suggestions?: string[]) => {
    let fullTextToQuote = textToQuote;
    if (suggestions && suggestions.length > 0) {
        fullTextToQuote += '\n' + suggestions.map(s => `${SUGGESTION_START_TAG}${s}${SUGGESTION_END_TAG}`).join('\n');
    }
    const quotedText = fullTextToQuote.split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
    setUserInput(prev => quotedText + prev);
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestionText: string) => {
    performSendMessage(suggestionText, false);
    setUserInput(''); 
    inputRef.current?.focus();
  };

  const handleConfirmClearChat = () => {
    if (currentAbortControllerRef.current) {
        currentAbortControllerRef.current.abort(); 
    }
    setChatMessages([]); 
    setIsMarkieTyping(false);
    setProposalStatus({}); 
    
    let newPrefs = userPreferences;
    if (clearFactsCheckbox) {
      newPrefs = clearAllRememberedFacts(); 
      setUserPreferences(newPrefs); // Update state
      // saveUserPreferences(newPrefs) is implicitly called by clearAllRememberedFacts
      displayNotification("Chat & Markie's memory cleared.", "info");
    } else {
      displayNotification("Chat messages cleared.", "info");
    }
    setClearFactsCheckbox(false); 

    if (ai && internalApiKeyExists) { 
        initializeChat(newPrefs, []); 
    }
    setIsClearChatModalOpen(false);
    inputRef.current?.focus();
    if (internalApiKeyExists && !pendingChatAction) { 
      setTimeout(() => displayWelcomeMessageCallback(), 0);
    }
  };

  const handleScroll = () => {
    if (chatScrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatScrollContainerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50; 
      setUserScrolledUp(!atBottom);
    }
  };

  useEffect(() => {
    const scrollContainer = chatScrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToBottomHandler = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setUserScrolledUp(false); 
  };


  const isInputDisabled = !internalApiKeyExists || isMarkieTyping;
  const showStopButton = isMarkieTyping && chatMessages.some(msg => msg.isStreaming);
  
  const getFormattedTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className="fixed inset-0 bg-slate-200 text-slate-800 flex flex-col z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-page-title"
    >
      <header className="p-3 md:p-4 bg-white flex justify-between items-center border-b border-slate-300 shrink-0 shadow-sm">
        <div className="flex items-center space-x-2">
            <button
            onClick={onNavigateBack}
            className="p-2 text-slate-600 hover:text-sky-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-lg flex items-center transition-colors text-sm font-medium"
            aria-label="Back to editor"
            >
            <ArrowLeftIcon className="w-4 h-4 mr-1.5" />
            Back
            </button>
            <button
                onClick={() => setIsClearChatModalOpen(true)}
                disabled={!internalApiKeyExists || (chatMessages.length === 0 && Object.keys(userPreferences.rememberedFacts).length === 0)}
                className="p-2 text-slate-600 hover:text-red-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 rounded-lg flex items-center transition-colors text-sm font-medium"
                aria-label="Clear chat messages and/or remembered facts"
            >
                <TrashIcon className="w-4 h-4 mr-1.5" />
                Clear Chat
            </button>
        </div>
        <h2 id="chat-page-title" className="text-base md:text-lg font-semibold text-sky-700 flex items-center mx-auto">
          <ChatBubbleIcon className="w-5 h-5 md:w-6 md:h-6 mr-2" />
          Chat with Markie
        </h2>
        <div className="w-32 md:w-48 flex justify-end"> {/* Spacer for centering title */}
        </div>
      </header>

      <div 
        ref={chatScrollContainerRef}
        className="flex-grow p-3 md:p-4 overflow-y-auto space-y-4 bg-slate-100 scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-slate-200 relative"
      >
        {internalApiKeyExists === false && (
          <div className="mb-4 p-3 bg-amber-50 text-amber-700 border border-amber-300 rounded-lg text-sm shadow-md flex items-center animate-chat-message-enter">
            <XCircleIcon className="w-5 h-5 mr-2 shrink-0 text-amber-600" />
            <span>Markie is unavailable. The API_KEY is not configured.</span>
          </div>
        )}

        {chatMessages.map((msg) => {
          const textForDisplay = msg.text; 
          
          const htmlToRender = micromark(textForDisplay, {allowDangerousHtml: true, extensions: [gfm()], htmlExtensions: [gfmHtml()] });
          const messageSegments = msg.participant === ChatParticipant.MARKIE ? parseHtmlIntoSegments(htmlToRender, msg.id) : null;

          const currentProposalStatus = proposalStatus[msg.id];
          
          const IconComponent = 
            msg.participant === ChatParticipant.USER ? UserIcon :
            msg.participant === ChatParticipant.MARKIE ? ChatBubbleIcon :
            XMarkIcon; 

          const iconColor =
            msg.participant === ChatParticipant.USER ? 'text-sky-600' :
            msg.participant === ChatParticipant.MARKIE ? 'text-purple-600' : 
            'text-red-600';
            
          const bubbleClasses = 
            msg.participant === ChatParticipant.USER
              ? 'bg-sky-500 text-white'
              : msg.participant === ChatParticipant.ERROR
              ? 'bg-red-100 text-red-700 border border-red-300'
              : 'bg-white text-slate-800 border border-slate-300';

          return (
            <div key={msg.id} className={`flex flex-col ${msg.participant === ChatParticipant.USER ? 'items-end' : 'items-start'} animate-chat-message-enter`}>
              <div className={`flex items-start space-x-2.5 ${msg.participant === ChatParticipant.USER ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <IconComponent className={`w-6 h-6 ${iconColor} mt-1.5 shrink-0`} />
                <div
                  className={`relative max-w-xs md:max-w-md lg:max-w-xl xl:max-w-3xl px-3.5 py-2.5 rounded-xl shadow-md ${bubbleClasses}`}
                >
                  <div className="prose-styles prose-sm chat-message-content text-sm leading-relaxed">
                  {msg.participant === ChatParticipant.MARKIE && messageSegments ? (
                    messageSegments.map((segment) => (
                      <React.Fragment key={segment.id}>
                        {segment.type === 'codeblock' && segment.rawCode ? (
                          <div className="relative my-2"> 
                            <button
                              onClick={() => handleCopyToClipboard(segment.rawCode!, segment.id + '-code')}
                              className="absolute top-1.5 right-1.5 z-10 p-1 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-md opacity-75 hover:opacity-100 transition-all"
                              aria-label="Copy code block"
                            >
                              {copiedStates[segment.id + '-code'] ? <CheckCircleIcon className="w-3.5 h-3.5 text-green-600" /> : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
                            </button>
                            <div dangerouslySetInnerHTML={{ __html: segment.htmlContent }} /> 
                          </div>
                        ) : (
                          <div dangerouslySetInnerHTML={{ __html: segment.htmlContent }} />
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: htmlToRender }} />
                  )}
                  </div>

                  {msg.isStreaming && <span className="inline-block animate-pulse ml-1 text-xs">...</span>}

                  {msg.participant === ChatParticipant.MARKIE && !msg.isStreaming && msg.systemActionFeedback && msg.systemActionFeedback.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-300/70">
                      <h4 className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center">
                        <AdjustmentsHorizontalIcon className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        System Actions Log:
                      </h4>
                      <ul className="space-y-1 text-xs text-slate-600 list-disc list-inside pl-1">
                        {msg.systemActionFeedback.map((feedback, index) => (
                          <li key={`${msg.id}-sysfeedback-${index}`}>{feedback}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!msg.isStreaming && (
                    <div className={`mt-2 pt-2 border-t ${msg.participant === ChatParticipant.USER ? 'border-sky-400/30' : 'border-slate-300/70'} flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs`}>
                       {msg.participant === ChatParticipant.MARKIE && msg.isEditProposal && msg.proposedDocContent && !currentProposalStatus && (
                         <>
                             <button
                                onClick={() => handleViewChanges(msg.proposedDocContent!)}
                                className="flex items-center justify-center px-2.5 py-1 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-md shadow-sm transition-colors text-xs"
                                aria-label="View proposed changes"
                            >
                                <EyeIcon className="w-3.5 h-3.5 mr-1" /> View
                            </button>
                            <button
                                onClick={() => handleApplyProposal(msg.proposedDocContent!, msg.id)}
                                className="flex items-center justify-center px-2.5 py-1 bg-green-500 hover:bg-green-600 text-white font-medium rounded-md shadow-sm transition-colors text-xs"
                                aria-label="Apply proposed changes"
                            >
                                <CheckCircleIcon className="w-3.5 h-3.5 mr-1" /> Apply
                            </button>
                            <button
                                onClick={() => handleDiscardProposal(msg.id)}
                                className="flex items-center justify-center px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white font-medium rounded-md shadow-sm transition-colors text-xs"
                                aria-label="Discard proposed changes"
                            >
                                <XCircleIcon className="w-3.5 h-3.5 mr-1" /> Discard
                            </button>
                            <button
                                onClick={() => handleCopyToClipboard(msg.proposedDocContent!, msg.id + '-proposal')}
                                className="flex items-center justify-center px-2.5 py-1 bg-slate-400 hover:bg-slate-500 text-white font-medium rounded-md shadow-sm transition-colors text-xs"
                                aria-label="Copy proposed document changes"
                            >
                                <DocumentDuplicateIcon className="w-3.5 h-3.5 mr-1" /> {copiedStates[msg.id + '-proposal'] ? 'Copied!' : 'Copy'}
                            </button>
                         </>
                       )}
                       {currentProposalStatus === 'discarded' && msg.isEditProposal && (
                         <p className="italic text-slate-500 w-full text-xs">Proposal discarded.</p>
                       )}
                        {msg.participant === ChatParticipant.MARKIE && !msg.isEditProposal && textForDisplay.trim().length > 0 && (!messageSegments || !messageSegments.some(s => s.type === 'codeblock')) && (
                             <button
                                onClick={() => handleCopyToClipboard(textForDisplay, msg.id + '-text')}
                                className="text-slate-500 hover:text-sky-600 flex items-center"
                                aria-label="Copy Markie's response text"
                             >
                                <CopyIcon className="w-3.5 h-3.5 mr-1"/> {copiedStates[msg.id + '-text'] ? 'Copied!' : 'Copy'}
                             </button>
                        )}
                        <button
                            onClick={() => handleQuoteMessage(msg.text, msg.suggestions)} 
                            className={`${msg.participant === ChatParticipant.USER ? 'text-sky-200 hover:text-white' : 'text-slate-500 hover:text-sky-600'} flex items-center ml-auto`}
                            aria-label="Quote this message"
                        >
                            <ChatBubbleLeftRightIcon className="w-4 h-4 mr-1" /> Quote
                        </button>
                    </div>
                  )}

                  {msg.participant === ChatParticipant.MARKIE && msg.groundingSources && msg.groundingSources.length > 0 && !msg.isStreaming && (
                    <div className="mt-2.5 pt-2 border-t border-slate-300/70">
                      <h4 className="text-xs font-semibold text-slate-500 mb-1">Sources:</h4>
                      <ul className="space-y-0.5">
                        {msg.groundingSources.map((source, index) => (
                          source.web && source.web.uri && (
                            <li key={`${msg.id}-source-${index}`} className="text-xs">
                              <a
                                href={source.web.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-600 hover:text-sky-700 hover:underline break-all"
                                title={source.web.title || source.web.uri}
                              >
                                {source.web.title || new URL(source.web.uri).hostname}
                              </a>
                            </li>
                          )
                        ))}
                      </ul>
                    </div>
                  )}
                  {!msg.isStreaming && msg.participant === ChatParticipant.MARKIE && msg.suggestions && msg.suggestions.length > 0 &&
                   (!msg.isEditProposal || (msg.isEditProposal && currentProposalStatus)) && (
                    <div className="mt-2.5 pt-2 border-t border-slate-300/70">
                      <p className="text-xs font-semibold text-purple-700 mb-1.5">Suggestions:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestions.map((suggestion, index) => (
                          <button
                            key={`${msg.id}-suggestion-${index}`}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-medium rounded-full shadow-sm border border-purple-200 transition-all duration-150 ease-in-out hover:shadow-md focus:outline-none focus:ring-1 focus:ring-purple-400"
                            aria-label={`Send suggestion: ${suggestion}`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className={`text-xs mt-1 ${msg.participant === ChatParticipant.USER ? 'mr-9 self-end' : 'ml-9 self-start'} ${ msg.participant === ChatParticipant.ERROR ? 'text-red-500' : 'text-slate-500'}`}>
                {getFormattedTimestamp(msg.timestamp)}
              </div>
            </div>
          );
        })}
        {isMarkieTyping && !chatMessages.some(msg => msg.isStreaming) && ( 
           <div className="flex items-start space-x-2.5 animate-chat-message-enter">
             <ChatBubbleIcon className="w-6 h-6 text-purple-600 mt-1.5 shrink-0" />
             <div className="max-w-xs md:max-w-md lg:max-w-lg px-3.5 py-2.5 rounded-xl shadow-md bg-white text-slate-800 border border-slate-300">
                <span className="animate-pulse text-sm">Markie is typing...</span>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
        {userScrolledUp && (
          <button
            onClick={scrollToBottomHandler}
            className="sticky bottom-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 transition-all duration-150 ease-in-out flex items-center animate-bounce hover:scale-105 focus:scale-105"
            aria-label="Scroll to latest messages"
          >
            <ArrowLongDownIcon className="w-4 h-4 mr-1.5" /> 
            Scroll to Bottom
          </button>
        )}
      </div>

      <div className="p-3 md:p-4 border-t border-slate-300 bg-white shrink-0">
        <div className="flex items-stretch space-x-2">
          <textarea
            ref={inputRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={!internalApiKeyExists ? "Markie is unavailable (API key missing)" : (isMarkieTyping ? "Markie is generating..." : "Ask Markie anything...")}
            className="flex-grow py-2 px-3 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none resize-none scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
            rows={1}
            aria-label="Chat input"
            disabled={!internalApiKeyExists || isMarkieTyping} 
          />
          {showStopButton ? (
             <button
                onClick={handleStopGeneration}
                className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:ring-offset-white flex items-center justify-center transition-colors duration-150 ease-in-out text-sm font-medium"
                aria-label="Stop message generation"
              >
                <StopCircleIcon className="w-5 h-5 mr-1.5" /> Stop
              </button>
          ) : (
            <button
                onClick={handleFormSubmit}
                disabled={!internalApiKeyExists || !userInput.trim() || isMarkieTyping} 
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white flex items-center justify-center transition-colors duration-150 ease-in-out"
                aria-label="Send message"
            >
                <SendIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        {internalApiKeyExists === false && !chatMessages.some(msg => msg.participant === ChatParticipant.ERROR && msg.text.toLowerCase().includes("api_key")) && ( 
            <p className="text-xs text-red-600 mt-1.5">Markie's features disabled. Configure API_KEY.</p>
        )}
      </div>
      <ConfirmationModal
        isOpen={isClearChatModalOpen}
        title="Clear Chat & Markie's Memory"
        message="Clear all messages in this session?"
        onConfirm={handleConfirmClearChat}
        onCancel={() => setIsClearChatModalOpen(false)}
        confirmText="Clear"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
        checkboxLabel="Also clear Markie's remembered facts"
        isCheckboxChecked={clearFactsCheckbox}
        onCheckboxChange={(isChecked) => setClearFactsCheckbox(isChecked)}
      />
      {diffModalContent && (
        <DiffViewerModal
            isOpen={isDiffModalOpen}
            originalContent={diffModalContent.original}
            newContent={diffModalContent.new}
            onClose={() => setIsDiffModalOpen(false)}
        />
      )}
      <style>{`
        .chat-message-content p { margin-bottom: 0.5rem; color: inherit; }
        .chat-message-content ul, .chat-message-content ol { margin-left: 1rem; margin-bottom: 0.5rem; color: inherit; }
        .chat-message-content li { margin-bottom: 0.25rem; color: inherit; }
        .chat-message-content a { color: #0284c7; text-decoration: underline; } /* sky-600 */
        .chat-message-content a:hover { color: #0369a1; } /* sky-700 */
        
        .chat-message-content code:not(pre code) { 
            background-color: #e2e8f0; /* slate-200 */
            color: #0f172a; /* slate-900 */
            padding: 0.15em 0.3em;
            border-radius: 0.25em;
            font-family: 'Courier New', Courier, monospace;
            font-size: 0.85em; 
            border: 1px solid #cbd5e1; /* slate-300 */
        }
        /* Enhanced code block styling */
        .chat-message-content pre { 
            background-color: #1e293b !important; /* slate-800 */
            border: 1px solid #334155 !important; /* slate-700 */
            color: #e2e8f0 !important; /* slate-200 */
            padding: 0.85em !important; 
            border-radius: 0.375em !important; /* rounded-md */
            overflow-x: auto !important; 
            margin-top: 0.6em !important;
            margin-bottom: 0.6em !important; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            scrollbar-width: thin;
            scrollbar-color: #475569 #1e293b; /* slate-600 slate-800 */
        }
        .chat-message-content pre::-webkit-scrollbar {
            height: 8px;
        }
        .chat-message-content pre::-webkit-scrollbar-track {
            background: #1e293b; /* slate-800 */
        }
        .chat-message-content pre::-webkit-scrollbar-thumb {
            background-color: #475569; /* slate-600 */
            border-radius: 4px;
            border: 2px solid #1e293b; /* slate-800 */
        }
        .chat-message-content pre code { 
            background-color: transparent !important; 
            color: inherit !important; 
            padding: 0 !important;
            border-radius: 0 !important;
            border: none !important;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
            font-size: 0.875em; 
            white-space: pre; 
        }
        
        .chat-message-content blockquote {
            border-left: 3px solid #94a3b8; /* slate-400 */
            padding-left: 0.75rem;
            margin-left: 0;
            font-style: italic;
            color: #475569; /* slate-600 */
        }
      `}</style>
    </div>
  );
};

export default ChatPage;
