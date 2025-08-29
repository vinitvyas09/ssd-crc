"use client";

import { useChat } from "@ai-sdk/react";
import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Calculator } from "./tool-calculator";
import { TavilySearch } from "./tool-tavilysearch";

// Add debug logging to help understand what's happening with message updates
function useDebuggedChat(options: Parameters<typeof useChat>[0]) {
  const chatHook = useChat(options);
  const { messages } = chatHook;
  
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      console.log('Message updated:', {
        id: lastMessage.id,
        role: lastMessage.role,
        parts: lastMessage.parts?.map(part => ({
          type: part.type,
          state: part.type === 'tool-invocation' ? part.toolInvocation.state : undefined,
          text: part.type === 'text' ? part.text.substring(0, 20) + '...' : undefined,
          keys: part.type === 'tool-invocation' ? Object.keys(part.toolInvocation) : undefined
        }))
      });
    }
  }, [messages]);
  
  return chatHook;
}

// Minimal type for the message object received by onFinish
type FinishMessage = {
  id: string;
  parts?: Array<
    | { type: 'text'; text: string }
    | {
        type: 'tool-invocation';
        toolInvocation: {
          state?: string;
          name?: string;
          input?: Record<string, unknown>;
        };
      }
  >;
};

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useDebuggedChat({
    initialMessages: [],
    id: 'esteem-ai-chat',
    onResponse: (response: Response) => {
      // When a new response starts, we can log debugging info
      console.log('Chat response started:', { status: response.status });
    },
    onFinish: (message: FinishMessage) => {
      // When a response finishes, we can verify the final message structure
      console.log('Chat response finished:', { 
        id: message.id,
        parts: message.parts?.length
      });
      
      // Auto-focus the textarea when the AI response finishes
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const lastScrollPositionRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    if (shouldAutoScroll) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [shouldAutoScroll]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (lastScrollPositionRef.current > scrollTop) {
        setShouldAutoScroll(false);
      }
      if (scrollHeight - scrollTop - clientHeight < 10) {
        setShouldAutoScroll(true);
      }
      lastScrollPositionRef.current = scrollTop;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const lastMessageParts = lastMessage?.parts ?? [];
    const lastPart = lastMessageParts[lastMessageParts.length - 1];
    const isThinking = lastPart?.type === 'tool-invocation' && lastPart.toolInvocation.state === 'call';

    if (shouldAutoScroll || isThinking) {
      scrollToBottom();
    }
  }, [messages, shouldAutoScroll, scrollToBottom]);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    textarea.style.height = 'auto';
    const maxHeight = 24 * 4;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShouldAutoScroll(true);
    handleSubmit(e);
    if (textareaRef.current) {
      setTimeout(() => adjustTextareaHeight(), 0);
    }
  };

  const markdownComponents: Components = {
    h1: ({children}) => <h1 className="text-xl font-semibold mt-2 mb-3 text-neutral-800 dark:text-neutral-200">{children}</h1>,
    h2: ({children}) => <h2 className="text-lg font-semibold mt-2 mb-2 text-neutral-800 dark:text-neutral-200">{children}</h2>,
    h3: ({children}) => <h3 className="text-base font-semibold mt-2 mb-2 text-neutral-800 dark:text-neutral-200">{children}</h3>,
    p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
    strong: ({children}) => <strong className="font-semibold text-neutral-900 dark:text-neutral-100">{children}</strong>,
    ul: ({children}) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
    ol: ({children}) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
    li: ({children}) => <li className="mb-1">{children}</li>,
    a: ({children, href}) => <a href={href} className="text-amber-600 dark:text-amber-400 hover:underline">{children}</a>,
    blockquote: ({children}) => <blockquote className="border-l-2 border-neutral-300 dark:border-neutral-600 pl-3 italic my-2">{children}</blockquote>,
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match && !className;
      return isInline ? (
        <code className="bg-neutral-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
      ) : (
        <code className="block bg-neutral-100 dark:bg-zinc-800/80 p-2 rounded-md text-xs font-mono overflow-x-auto my-2" {...props}>
          {children}
        </code>
      );
    }
  };

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto h-[78vh] rounded-xl overflow-hidden bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 shadow-lg font-sans">
      <div 
        ref={chatContainerRef} 
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-thumb-rounded-full hover:scrollbar-thumb-neutral-400 dark:scrollbar-thumb-zinc-700 dark:hover:scrollbar-thumb-zinc-600 scrollbar-track-transparent"
      >
        <div className="p-6 space-y-5">
          {messages.length === 0 && (
            <div className="text-center py-24">
              <div className="text-neutral-400 font-light">How can I help you today?</div>
            </div>
          )}
          {messages.map((message, index) => (
            <div 
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className={`p-4 rounded-lg max-w-[85%] ${
                message.role === 'user' 
                  ? 'bg-amber-50 dark:bg-amber-950/30 text-neutral-800 dark:text-neutral-200 border border-amber-100 dark:border-amber-900/30' 
                  : 'bg-neutral-50 dark:bg-zinc-800/80 text-neutral-800 dark:text-neutral-200 border border-neutral-100 dark:border-zinc-700/80'
              } shadow-sm transition-all`}>
                <div className="font-medium text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="prose-sm dark:prose-invert max-w-none">
                  {message.role === 'user' ? (
                    (message.parts ?? []).map((part, partIndex) => {
                      switch (part.type) {
                        case 'text':
                          return (
                            <div key={partIndex} className="whitespace-pre-wrap text-sm leading-relaxed markdown-content">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                              >
                                {part.text}
                              </ReactMarkdown>
                            </div>
                          );
                        default:
                          return <div key={partIndex} className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>;
                      }
                    })
                  ) : (
                    <>
                      {(() => {
                        // 1. Check if the message has any parts
                        if (!message.parts || message.parts.length === 0) {
                          return <div className="text-xs italic text-neutral-500 dark:text-neutral-400">...</div>;
                        }
                        
                        // 2. Check if the message is in "tool call" state
                        const isToolCall = message.parts.some(part => 
                          part.type === 'tool-invocation' && 
                          part.toolInvocation && 
                          part.toolInvocation.state === 'call'
                        );
                        
                        // 3. Check if the message has text content
                        const textParts = message.parts.filter(part => part.type === 'text');
                        const hasText = textParts.length > 0 && textParts.some(part => part.text.trim() !== '');
                        
                        // If a tool is being called but there's no text yet, show the thinking state
                        if (isToolCall && !hasText) {
                          console.log("RENDERING TOOL CALL UI - Tool invocation detected", {
                            allParts: message.parts,
                          });
                          
                          // Get the input from all tool invocation parts to determine which tool is being used
                          let isTavilySearch = false;
                          let isCalculator = false;
                          let toolName = "unknown";
                          
                          // Check all parts for tool invocations
                          message.parts.forEach(part => {
                            if (part.type === 'tool-invocation') {
                              // Check if this is a Tavily search (has a query parameter)
                              try {
                                const input = JSON.parse(JSON.stringify(part));
                                console.log("[Tool Detection] Tool invocation part:", input);
                                
                                if (input?.toolInvocation?.input?.query) {
                                  console.log("[Tool Detection] Found Tavily with query:", input.toolInvocation.input.query);
                                  isTavilySearch = true;
                                  toolName = "tavilySearch";
                                }
                                
                                if (input?.toolInvocation?.input?.operation) {
                                  console.log("[Tool Detection] Found Calculator with operation:", input.toolInvocation.input.operation);
                                  isCalculator = true;
                                  toolName = "calculator";
                                }
                                
                                // Log the actual tool name from the API if available
                                if (input?.toolInvocation?.name) {
                                  console.log("[Tool Detection] ACTUAL TOOL NAME:", input.toolInvocation.name);
                                  toolName = input.toolInvocation.name;
                                  
                                  // Direct check based on the tool name
                                  if (input.toolInvocation.name === "tavilySearch") {
                                    isTavilySearch = true;
                                  }
                                }
                              } catch {
                                console.error("[Tool Detection] Error parsing tool invocation");
                              }
                            }
                          });
                          
                          console.log("[Tool Detection] Tool detection results:", { 
                            isTavilySearch,
                            isCalculator,
                            toolName
                          });
                          
                          // Check if the registered tool name is "tavilySearch" directly
                          let showTavilySearch = false;
                          message.parts.forEach(part => {
                            if (part.type === 'tool-invocation') {
                              try {
                                const stringified = JSON.stringify(part);
                                // Direct string search for the registered tool name
                                if (stringified.includes('"tavilySearch"')) {
                                  console.log("[Tool Detection] Found string 'tavilySearch' in tool invocation");
                                  showTavilySearch = true;
                                }
                              } catch {
                                // Ignore errors
                              }
                            }
                          });
                          
                          // Use the direct string detection as a fallback
                          return (isTavilySearch || toolName === "tavilySearch" || showTavilySearch) ? 
                            <TavilySearch /> : <Calculator />;
                        }
                        
                        // Otherwise, render all text parts
                        return (
                          <>
                            {textParts.map((part, idx) => (
                              <div key={`text-${idx}`} className="whitespace-pre-wrap text-sm leading-relaxed markdown-content">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={markdownComponents}
                                >
                                  {part.text}
                                </ReactMarkdown>
                              </div>
                            ))}
                          </>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="border-t border-neutral-200 dark:border-zinc-800 p-4 bg-neutral-50 dark:bg-zinc-900">
        <form onSubmit={handleFormSubmit} className="relative flex items-center">
          <div className="relative flex-1 overflow-hidden rounded-full border border-neutral-200 dark:border-zinc-700 focus-within:border-amber-300 dark:focus-within:border-amber-700 focus-within:ring-2 focus-within:ring-amber-200 dark:focus-within:ring-amber-900/30 transition-all bg-white dark:bg-zinc-800">
            <textarea
              ref={textareaRef}
              className="w-full bg-transparent text-neutral-800 dark:text-neutral-200 pl-5 pr-12 py-2.5 focus:outline-none placeholder-neutral-400 text-sm resize-none overflow-y-auto min-h-[46px] max-h-[116px] leading-[1.5rem] align-middle"
              value={input}
              onChange={(e) => {
                handleInputChange(e);
                adjustTextareaHeight();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleFormSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
                }
              }}
              placeholder="Type a message..."
              disabled={isLoading}
              rows={1}
              style={{
                paddingTop: input ? '0.625rem' : '0.75rem',
                paddingBottom: input ? '0.625rem' : '0.75rem'
              }}
            />
            <button 
              type="submit" 
              disabled={isLoading}
              className="absolute right-1.5 top-1/2 transform -translate-y-1/2 bg-amber-600 hover:bg-amber-700 text-white p-2.5 rounded-full hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50 disabled:hover:bg-amber-600"
              aria-label="Send message"
            >
              <Send size={16} className="text-white" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 
