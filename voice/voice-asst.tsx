"use client";

import { useVapi } from "@/voice/voice-handler";
import { AssistantButton } from "@/voice/voice-button";
import { useRef, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageRoleEnum, MessageTypeEnum } from "./voice.type";
import "./voice.css";
import { ChevronDown, ChevronUp, Mic, MicOff, Sparkles, Phone, Activity, Clock, MessageSquare } from "lucide-react";

function Voice() {
    const { toggleCall, callStatus, audioLevel, messages, activeTranscript, isSpeechActive } = useVapi();
    const [isOverlayActive, setIsOverlayActive] = useState(false);
    const [showTranscript, setShowTranscript] = useState(false);
    const audioVisualizer = useRef<HTMLDivElement>(null);
    
    // Toggle overlay when voice is activated
    useEffect(() => {
      if (callStatus === "active" || callStatus === "loading") {
        setIsOverlayActive(true);
      } else {
        // Add slight delay before hiding overlay to allow for smooth animations
        const timer = setTimeout(() => setIsOverlayActive(false), 500);
        return () => clearTimeout(timer);
      }
    }, [callStatus]);

    // Get latest assistant message to display
    const latestAssistantMessage = messages
      .filter(msg => 
        msg.role === MessageRoleEnum.ASSISTANT && 
        msg.type === MessageTypeEnum.MODEL_OUTPUT
      )
      .pop();

    // Get latest function call if any
    const latestFunctionCall = messages
      .filter(msg => 
        msg.role === MessageRoleEnum.ASSISTANT && 
        msg.type === MessageTypeEnum.FUNCTION_CALL
      )
      .pop();

    // Count total messages in conversation
    const messageCount = messages.filter(msg => 
      msg.type === MessageTypeEnum.MODEL_OUTPUT || 
      msg.type === MessageTypeEnum.TRANSCRIPT
    ).length;

    // Calculate call duration
    const [callDuration, setCallDuration] = useState(0);
    useEffect(() => {
      let interval: NodeJS.Timeout;
      if (callStatus === "active") {
        const startTime = Date.now();
        interval = setInterval(() => {
          setCallDuration(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
      } else {
        setCallDuration(0);
      }
      return () => clearInterval(interval);
    }, [callStatus]);

    const formatDuration = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleButtonClick = () => {
      toggleCall();
    };

    const toggleTranscript = () => {
      setShowTranscript(prev => !prev);
    };
    
    // Get the appropriate status message
    const getStatusMessage = () => {
      if (callStatus === "active") {
        return isSpeechActive ? "Assistant is responding..." : "Listening to you...";
      } else if (callStatus === "loading") {
        return "Preparing voice assistant...";
      } else {
        return "Ready";
      }
    };

    return (
      <>
        <div className="fixed bottom-8 right-8 z-40">
          <AssistantButton
            audioLevel={audioLevel}
            callStatus={callStatus}
            toggleCall={handleButtonClick}
          />
        </div>

        <AnimatePresence>
          {isOverlayActive && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 backdrop-blur-sm z-30 flex items-center justify-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="backdrop-blur-md rounded-2xl p-6 shadow-2xl max-w-2xl w-full mx-4"
                style={{ 
                  background: 'var(--panel)',
                  border: '1px solid var(--grid)'
                }}
              >
                {/* Audio Visualization */}
                <div className="flex justify-center mb-6">
                  <motion.div 
                    className="relative h-24 w-24"
                    animate={{ 
                      scale: isSpeechActive ? [1, 1.05, 1] : 1 
                    }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: isSpeechActive ? Infinity : 0,
                      ease: "easeInOut" 
                    }}
                  >
                    <div ref={audioVisualizer} className="absolute inset-0 flex items-center justify-center">
                      <div className={`audio-waves ${isSpeechActive ? 'active' : ''}`}>
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div 
                            key={i} 
                            className="wave"
                            style={{
                              animationDelay: `${i * 0.1}s`,
                              height: `${Math.min(100, 40 + audioLevel * 60 * (0.5 + Math.sin(i) * 0.5))}%`,
                              opacity: isSpeechActive ? 0.7 + audioLevel * 0.3 : 0.3,
                              backgroundColor: callStatus === "active" ? 
                                isSpeechActive ? 
                                  "var(--accent)" : // blue when user is speaking
                                  "var(--ok)" // green when assistant is speaking
                                : "var(--warn)" // amber when loading
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Transcript Toggle */}
                <div className="text-center mb-1">
                  <button 
                    onClick={toggleTranscript}
                    className="text-xs font-light inline-flex items-center gap-1 transition-colors px-2 py-1 rounded-full hover:opacity-80"
                    style={{
                      color: 'var(--muted)',
                      background: 'var(--panel-2)'
                    }}
                  >
                    {showTranscript ? (
                      <>Hide transcript <ChevronUp size={12} /></>
                    ) : (
                      <>Show transcript <ChevronDown size={12} /></>
                    )}
                  </button>
                </div>

                {/* Transcription */}
                <AnimatePresence>
                  {showTranscript && activeTranscript && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-center overflow-hidden"
                    >
                      <motion.p 
                        key={activeTranscript.transcript}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="italic font-light"
                        style={{ color: 'var(--fg)' }}
                      >
                        "{activeTranscript.transcript}"
                      </motion.p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Assistant Response & Info Section */}
                <motion.div 
                  className="px-6 py-4 rounded-xl"
                  style={{
                    background: 'var(--panel-2)',
                    border: '1px solid var(--grid)'
                  }}
                  animate={{ 
                    boxShadow: isSpeechActive ? 
                      "0px 0px 0px rgba(255,255,255,0)" : 
                      "0px 0px 30px rgba(255,255,255,0.15)" 
                  }}
                  transition={{ duration: 0.5 }}
                >
                  {/* Header with Status Info */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <motion.div
                        animate={{ 
                          rotate: isSpeechActive ? [0, 360] : 0,
                          scale: isSpeechActive ? [1, 1.1, 1] : 1
                        }}
                        transition={{ 
                          rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                          scale: { duration: 1, repeat: Infinity }
                        }}
                      >
                        <Sparkles className="w-4 h-4" style={{ color: 'var(--ok)' }} />
                      </motion.div>
                      <h3 className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                        {callStatus === "loading" ? "Connecting" : "Assistant"}
                      </h3>
                    </div>
                    
                    {/* Call Stats */}
                    {callStatus === "active" && (
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(callDuration)}</span>
                        </div>
                        {messageCount > 0 && (
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>{messageCount}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Main Content Area */}
                  <AnimatePresence mode="wait">
                    {latestAssistantMessage ? (
                      <motion.div
                        key={(latestAssistantMessage as any)?.output}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                      >
                        <p className="text-lg font-light leading-relaxed" style={{ color: 'var(--fg)' }}>
                          {(latestAssistantMessage as any).output}
                        </p>
                        
                        {/* Function Call Indicator */}
                        {latestFunctionCall && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--grid)' }}
                          >
                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--accent)' }}>
                              <Activity className="w-3 h-3" />
                              <span>Using: {(latestFunctionCall as any).functionCall?.name}</span>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    ) : callStatus === "loading" ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-2"
                      >
                        <p className="text-lg font-light" style={{ color: 'var(--fg)' }}>
                          Setting up voice connection...
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="w-2 h-2 rounded-full" style={{ background: 'var(--ok)' }}
                                animate={{ 
                                  scale: [1, 1.5, 1],
                                  opacity: [0.5, 1, 0.5]
                                }}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  delay: i * 0.2
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ) : callStatus === "active" && !isSpeechActive ? (
                      <motion.div
                        key="listening"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <Mic className="w-5 h-5" style={{ color: 'var(--ok)' }} />
                          </motion.div>
                          <p className="text-lg font-light" style={{ color: 'var(--fg)' }}>
                            Listening...
                          </p>
                        </div>
                        
                        {/* Helpful Tips */}
                        <div className="space-y-2 text-sm" style={{ color: 'var(--muted)' }}>
                          <p className="italic">Try asking me to:</p>
                          <ul className="space-y-1 ml-4">
                            <li>• Search for current information</li>
                            <li>• Perform calculations</li>
                            <li>• Answer your questions</li>
                          </ul>
                        </div>
                      </motion.div>
                    ) : callStatus === "active" && isSpeechActive ? (
                      <motion.div
                        key="speaking"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <Activity className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                        <p className="text-lg font-light" style={{ color: 'var(--fg)' }}>
                          Processing your request...
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <p className="text-white/60 dark:text-zinc-400 text-base">
                          Click the button below to start a conversation
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Status Indicator */}
                <div className="mt-6 text-center">
                  <motion.p 
                    animate={{
                      opacity: [0.6, 0.9, 0.6]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="text-white/60 dark:text-zinc-400/60 text-sm"
                  >
                    {getStatusMessage()}
                  </motion.p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
}

export { Voice };