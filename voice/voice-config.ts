import { system_prompt } from "@/chat/prompt";
import { getVapiFunctions } from "@/tools/unified-tools";
import type {
  CreateAssistantDTO,
  CreateFunctionToolDTO,
  OpenAIFunction,
} from "@vapi-ai/web/dist/api";

// Get the base URL for the functions server
const getServerUrl = () => {
  // In production, use the actual domain
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    const url = process.env.NEXT_PUBLIC_VERCEL_URL;
    // Check if URL already has protocol
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Add https:// if no protocol
    return `https://${url}`;
  }
  // In development, use localhost
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

const buildVoiceAssistantTools = (): CreateFunctionToolDTO[] =>
  getVapiFunctions().map((fn) => ({
    type: "function",
    function: fn as OpenAIFunction,
    server: {
      url: `${getServerUrl()}/api/voice/functions`,
    },
  }));

export const assistant: CreateAssistantDTO = {
  name: "Emily",
  voice: {
    voiceId: "tnSpp4vdxKPjI9w0GnoV",
    provider: "11labs",
    stability: 0.5,
    similarityBoost: 0.75,
  },
  model: {
    provider: "openai",
    model: "gpt-4.1",
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: system_prompt,
      },
    ],
    tools: buildVoiceAssistantTools(),
  },
  firstMessage:
    "Hey there! How can I assist you today?",
};
