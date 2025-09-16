import { system_prompt } from "@/chat/prompt";
import { getVapiFunctions } from "@/tools/unified-tools";

type VapiFunctionDefinition = ReturnType<typeof getVapiFunctions>[number];

interface VoiceAssistantTool {
  type: "function";
  function: VapiFunctionDefinition;
  server: {
    url: string;
  };
}

interface VoiceAssistantConfig {
  name: string;
  voice: {
    voiceId: string;
    provider: "11labs" | string;
    stability: number;
    similarityBoost: number;
  };
  model: {
    provider: "openai" | string;
    model: string;
    temperature: number;
    systemPrompt: string;
    tools: VoiceAssistantTool[];
  };
  firstMessage: string;
}

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

const buildVoiceAssistantTools = (): VoiceAssistantTool[] =>
  getVapiFunctions().map((tool) => ({
    type: "function",
    function: tool,
    server: {
      url: `${getServerUrl()}/api/voice/functions`,
    },
  }));

export const assistant: VoiceAssistantConfig = {
  name: "Emily",
  voice: {
    voiceId: "tnSpp4vdxKPjI9w0GnoV",
    provider: "11labs",
    stability: 0.5,
    similarityBoost: 0.75
  },
  model: {
    provider: "openai",
    model: "gpt-4.1",
    temperature: 0.7,
    systemPrompt: system_prompt,
    tools: buildVoiceAssistantTools(),
  },
  firstMessage:
    "Hey there! How can I assist you today?",
};
