import { system_prompt } from "@/chat/prompt";
import { getVapiFunctions } from "@/tools/unified-tools";

// Get the base URL for the functions server
const getServerUrl = () => {
  // In production, use the actual domain
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  // In development, use localhost
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

export const assistant = {
  name: "Emily",
  voice: {
    voiceId: "tnSpp4vdxKPjI9w0GnoV",
    provider: "11labs" as const,
    stability: 0.5,
    similarityBoost: 0.75
  },
  model: {
    provider: "openai" as const,
    model: "gpt-4.1" as any,
    temperature: 0.7,
    systemPrompt: system_prompt,
    functions: getVapiFunctions(),
  },
  // Server URL for function execution
  serverUrl: `${getServerUrl()}/api/voice/functions`,
  firstMessage:
    "Hey there! How can I assist you today?",
};
