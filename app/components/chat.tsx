"use client";

import { useChat } from "@ai-sdk/react";
import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Calculator } from "./tool-calculator";
import { TavilySearch } from "./tool-tavilysearch";

// Simple wrapper around useChat for consistency
function useDebuggedChat(options: Parameters<typeof useChat>[0]) {
  return useChat(options);
}

export function Chat() {
  const { messages, sendMessage, status } = useDebuggedChat({
    messages: [],
    id: 'esteem-ai-chat',
    onFinish: ({ message }) => {
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
  const [input, setInput] = useState("");
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
    const isThinking = !!lastPart &&
      typeof (lastPart as { type?: unknown }).type === 'string' &&
      (lastPart as { type: string }).type.startsWith('tool-') &&
      (((lastPart as { state?: string }).state === 'input-streaming') || ((lastPart as { state?: string }).state === 'input-available'));

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
    const text = input.trim();
    if (text) {
      void sendMessage({ text });
      setInput("");
    }
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
    a: ({children, href}) => (
      <a href={href} className="hover:underline" style={{ color: 'var(--accent)' }}>
        {children}
      </a>
    ),
    blockquote: ({children}) => (
      <blockquote className="pl-3 italic my-2" style={{ borderLeft: '2px solid var(--accent)', color: 'var(--muted)' }}>
        {children}
      </blockquote>
    ),
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match && !className;
      return isInline ? (
        <code className="px-1 py-0.5 rounded text-xs font-mono" 
              style={{ background: 'var(--panel-2)', color: 'var(--accent)' }}>
          {children}
        </code>
      ) : (
        <code className="block p-2 rounded-md text-xs font-mono overflow-x-auto my-2" 
              style={{ background: 'var(--panel-2)', color: 'var(--fg)' }} 
              {...props}>
          {children}
        </code>
      );
    }
  };

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto h-full min-h-[72vh] mt-3 sm:mt-6 rounded-xl overflow-hidden shadow-lg font-sans" 
         style={{ 
           background: 'var(--panel)', 
           border: '1px solid var(--grid)' 
         }}>
      <div 
        ref={chatContainerRef} 
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent"
        style={{
          '--scrollbar-thumb': 'var(--muted)',
          '--scrollbar-thumb-hover': 'var(--fg)'
        } as React.CSSProperties}
      >
        <div className="p-4 sm:p-6 space-y-5">
          {messages.length === 0 && (
            <div className="text-center py-16 sm:py-24">
              <div className="font-light" style={{ color: 'var(--muted)' }}>How can I help you today?</div>
            </div>
          )}
          {messages.map((message, index) => (
            <div 
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className={`p-4 rounded-lg max-w-[90%] sm:max-w-[85%] shadow-sm transition-all`}
                   style={{
                     background: message.role === 'user' 
                       ? 'var(--accent)' 
                       : 'var(--panel-2)',
                     border: message.role === 'user'
                       ? '1px solid var(--accent-hover)'
                       : '1px solid var(--grid)',
                     color: message.role === 'user' ? 'white' : 'var(--fg)'
                   }}>
                <div className="font-medium text-xs mb-1.5" 
                     style={{ 
                       color: message.role === 'user' ? 'rgba(255,255,255,0.8)' : 'var(--muted)' 
                     }}>
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="prose-sm dark:prose-invert max-w-none">
                  {message.role === 'user' ? (
                    (message.parts ?? []).map((part, partIndex: number) => {
                      if (part.type === 'text') {
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
                      }
                      return (
                        <div key={partIndex} className="whitespace-pre-wrap text-sm leading-relaxed">…</div>
                      );
                    })
                  ) : (
                    <>
                      {(() => {
                        // 1. Check if the message has any parts
                        if (!message.parts || message.parts.length === 0) {
                          return <div className="text-xs italic text-neutral-500 dark:text-neutral-400">...</div>;
                        }
                        
                        // 2. Check if the message is in "tool call" state (not completed)
                        const activeToolCall = message.parts.find((part) => (
                          typeof (part as { type?: unknown }).type === 'string' &&
                          (part as { type: string }).type.startsWith('tool-') &&
                          (((part as { state?: string }).state === 'input-streaming') || ((part as { state?: string }).state === 'input-available'))
                        ));
                        
                        // 3. Check if the message has text content
                        const textParts = message.parts.filter(part => part.type === 'text');
                        const hasText = textParts.length > 0 && textParts.some(part => part.text && part.text.trim() !== '');
                        
                        // If a tool is actively being called but there's no text yet, show the thinking state
                        if (activeToolCall && !hasText) {
                          // Determine which tool is being called from the part type
                          const toolType = (activeToolCall as { type: string }).type;
                          if (toolType === 'tool-tavilySearch') return <TavilySearch />;
                          if (toolType === 'tool-calculator') return <Calculator />;
                          return <div className="text-xs italic text-neutral-500 dark:text-neutral-400">Thinking…</div>;
                        }
                        
                        // If we have text content, always render it (this includes tool results)
                        if (hasText) {
                          return (
                            <>
                              {textParts.map((part, idx) => (
                                <div key={`text-${idx}`} className="whitespace-pre-wrap text-sm leading-relaxed markdown-content">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={markdownComponents}
                                  >
                                    {part.text || ''}
                                  </ReactMarkdown>
                                </div>
                              ))}
                            </>
                          );
                        }
                        
                        // Check if there are completed tool parts waiting for text
                        const completedToolCall = message.parts.find((part) => (
                          typeof (part as { type?: unknown }).type === 'string' &&
                          (part as { type: string }).type.startsWith('tool-') &&
                          ((part as { state?: string }).state === 'result')
                        ));
                        
                        if (completedToolCall) {
                          console.log('Tool completed, waiting for text response:', completedToolCall);
                          return <div className="text-xs italic text-neutral-500 dark:text-neutral-400">Processing result...</div>;
                        }
                        
                        // Fallback for any other state
                        return <div className="text-xs italic text-neutral-500 dark:text-neutral-400">Processing...</div>;
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
      <div className="p-3 sm:p-4" 
           style={{ 
             borderTop: '1px solid var(--grid)', 
             background: 'var(--panel-2)' 
           }}>
        <form onSubmit={handleFormSubmit} className="relative flex items-center">
          <div className="relative flex-1 overflow-hidden rounded-full transition-all"
               style={{
                 border: '1px solid var(--grid)',
                 background: 'var(--panel)'
               }}>
            <textarea
              ref={textareaRef}
              className="w-full bg-transparent pl-5 pr-12 py-2.5 focus:outline-none text-sm resize-none overflow-y-auto min-h-[46px] max-h-[116px] leading-[1.5rem] align-middle"
              style={{
                color: 'var(--fg)',
                '--placeholder-color': 'var(--muted)',
                paddingTop: input ? '0.625rem' : '0.75rem',
                paddingBottom: input ? '0.625rem' : '0.75rem'
              } as React.CSSProperties}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleFormSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
                }
              }}
              placeholder="Type a message..."
              disabled={status === 'submitted' || status === 'streaming'}
              rows={1}
            />
            <button 
              type="submit" 
              disabled={status === 'submitted' || status === 'streaming'}
              className="absolute right-1.5 top-1/2 transform -translate-y-1/2 p-2.5 rounded-full hover:shadow-md transition-all focus:outline-none disabled:opacity-50"
              style={{
                background: 'var(--accent)',
                '--hover-bg': 'var(--accent-hover)'
              } as React.CSSProperties}
              aria-label="Send message"
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
            >
              <Send size={16} className="text-white" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 
