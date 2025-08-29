import { system_prompt } from "@/chat/prompt";
import { getVapiFunctions } from "@/tools/unified-tools";

export const assistant = {
  name: "Emily",
  voice: {
    voiceId: "tnSpp4vdxKPjI9w0GnoV",
    provider: "11labs",
    stability: 0.5,
    similarityBoost: 0.75
  },
  model: {
    provider: "openai",
    model: "gpt-4o",
    temperature: 0.7,
    systemPrompt: system_prompt,
    functions: getVapiFunctions(),
  },
  firstMessage:
    "Hey there! How can I assist you today?",
};
