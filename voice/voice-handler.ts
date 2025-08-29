/**
 * Voice handler module that provides a React hook for managing voice interactions
 * using the Vapi SDK. Handles call state, speech activity, and message processing.
 */
import { Message, MessageTypeEnum, TranscriptMessage, TranscriptMessageTypeEnum } from "@/voice/voice.type";
import { useEffect, useState } from "react";
import { vapi } from "@/voice/vapi.sdk";
import { assistant } from "@/voice/voice-config";

/**
 * Enum representing the possible states of a voice call
 */
export enum CALL_STATUS {
  INACTIVE = "inactive", // No active call
  ACTIVE = "active",     // Call in progress
  LOADING = "loading",   // Call is being initiated or terminated
}

/**
 * Custom hook that provides voice interaction functionality
 * @returns Object containing voice state and control functions
 */
export function useVapi() {
  // State to track if the user is currently speaking
  const [isSpeechActive, setIsSpeechActive] = useState(false);
  // Current status of the voice call
  const [callStatus, setCallStatus] = useState<CALL_STATUS>(CALL_STATUS.INACTIVE);
  // Array of messages exchanged during the voice conversation
  const [messages, setMessages] = useState<Message[]>([]);
  // Current partial transcript being processed
  const [activeTranscript, setActiveTranscript] = useState<TranscriptMessage | null>(null);
  // Audio input level for UI visualization
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    // Handler for when user starts speaking
    const onSpeechStart = () => setIsSpeechActive(true);
    
    // Handler for when user stops speaking
    const onSpeechEnd = () => {
      setIsSpeechActive(false);
    };

    // Handler for when call connection is established
    const onCallStartHandler = () => {
      setCallStatus(CALL_STATUS.ACTIVE);
    };

    // Handler for when call is terminated
    const onCallEnd = () => {
      setCallStatus(CALL_STATUS.INACTIVE);
    };

    // Handler for monitoring microphone volume level
    const onVolumeLevel = (volume: number) => {
      setAudioLevel(volume);
    };

    // Handler for processing incoming messages
    const onMessageUpdate = (message: Message) => {
      // Handle partial transcripts differently from complete messages
      if (
        message.type === MessageTypeEnum.TRANSCRIPT &&
        message.transcriptType === TranscriptMessageTypeEnum.PARTIAL
      ) {
        setActiveTranscript(message);
      } else {
        setMessages((prev) => [...prev, message]);
        setActiveTranscript(null);
      }
    };

    // Error handler for call failures
    const onError = (e: any) => {
      setCallStatus(CALL_STATUS.INACTIVE);
      console.error(e);
    };

    // Set up event listeners for the Vapi SDK
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("call-start", onCallStartHandler);
    vapi.on("call-end", onCallEnd);
    vapi.on("volume-level", onVolumeLevel);
    vapi.on("message", onMessageUpdate);
    vapi.on("error", onError);

    // Cleanup function to remove event listeners
    return () => {
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("call-start", onCallStartHandler);
      vapi.off("call-end", onCallEnd);
      vapi.off("volume-level", onVolumeLevel);
      vapi.off("message", onMessageUpdate);
      vapi.off("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Initiates a voice call with the configured assistant
   */
  const start = async () => {
    setCallStatus(CALL_STATUS.LOADING);
    try {
      console.log('Vapi config:', { 
        token: process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN ? '[SET]' : '[MISSING]',
        serverUrl: process.env.NEXT_PUBLIC_SERVER_URL ? '[SET]' : '[MISSING]',
        assistantConfig: {
          ...assistant,
          // Don't log the entire system prompt as it's too large
          model: { ...assistant.model, systemPrompt: assistant.model.systemPrompt ? '[SET]' : '[MISSING]' }
        }
      });
      
      const response = await vapi.start(assistant);
      // console.log("Vapi call started successfully:", response);
    } catch (error) {
      console.error("Error starting Vapi call:", error);
      setCallStatus(CALL_STATUS.INACTIVE);
    }
  };

  /**
   * Terminates the current voice call
   */
  const stop = () => {
    setCallStatus(CALL_STATUS.LOADING);
    vapi.stop();
  };

  /**
   * Toggles the call state between active and inactive
   */
  const toggleCall = () => {
    if (callStatus == CALL_STATUS.ACTIVE) {
      stop();
    } else {
      start();
    }
  };

  // Return state variables and control functions
  return {
    isSpeechActive,
    callStatus,
    audioLevel,
    activeTranscript,
    messages,
    start,
    stop,
    toggleCall,
  };
}