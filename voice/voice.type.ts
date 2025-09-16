export enum MessageTypeEnum {
    TRANSCRIPT = "transcript",
    FUNCTION_CALL = "function-call",
    FUNCTION_CALL_RESULT = "function-call-result",
    ADD_MESSAGE = "add-message",
    MODEL_OUTPUT = "output",
    CONVERSATION_UPDATE = "conversation-update",
  }
  
  export enum MessageRoleEnum {
    USER = "user",
    SYSTEM = "system",
    ASSISTANT = "assistant",
  }
  
  export enum TranscriptMessageTypeEnum {
    PARTIAL = "partial",
    FINAL = "final",
  }
  
  export interface BaseMessage {
    type: MessageTypeEnum;
    role: MessageRoleEnum;
  }
  
  export interface TranscriptMessage extends BaseMessage {
    type: MessageTypeEnum.TRANSCRIPT;
    transcriptType: TranscriptMessageTypeEnum;
    transcript: string;
  }
  
export interface FunctionCallMessage extends BaseMessage {
    type: MessageTypeEnum.FUNCTION_CALL;
    functionCall: {
      name: string;
      parameters: Record<string, unknown>;
    };
  }
  
  export interface FunctionCallResultPayload extends Record<string, unknown> {
    forwardToClientEnabled?: boolean;
    result: unknown;
  }

  export interface FunctionCallResultMessage extends BaseMessage {
    type: MessageTypeEnum.FUNCTION_CALL_RESULT;
    functionCallResult: FunctionCallResultPayload;
  }
  
  export interface ModelOutputMessage extends BaseMessage {
    type: MessageTypeEnum.MODEL_OUTPUT;
    output: string;
  }
  
  export interface ConversationUpdateMessage extends BaseMessage {
    type: MessageTypeEnum.CONVERSATION_UPDATE;
    conversation: { role: MessageRoleEnum; content: string }[];
  }
  
  export type Message =
    | TranscriptMessage
    | FunctionCallMessage
    | FunctionCallResultMessage
    | ModelOutputMessage
    | ConversationUpdateMessage;
  
