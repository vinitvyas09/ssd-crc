/**
 * Vercel AI SDK tool exports using unified tool definitions
 */
import { getVercelAITools } from "@/tools/unified-tools";

// Get the tools from the unified definitions
const tools = getVercelAITools();

// Export the tools for use in the chat API
export const calculatorTool = tools.calculatorTool;
export const tavilySearchTool = tools.tavilySearchTool;