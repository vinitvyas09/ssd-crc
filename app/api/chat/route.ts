import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { system_prompt } from "@/chat/prompt";
import { calculatorTool, tavilySearchTool } from "@/chat/tools";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  console.log("[API Route] Processing chat request with tools");
  console.log("[API Route] Tavily API Key present:", !!process.env.TAVILY_API_KEY);

  // Use streamText with the standard configuration
  const result = streamText({
    model: openai("gpt-4.1"),
    messages: convertToModelMessages(messages),
    system: system_prompt,
    maxToolRoundtrips: 2, // Allow tool use followed by text
    tools: {
      calculator: calculatorTool,
      tavilySearch: tavilySearchTool
    }
  });

  console.log("[API Route] Tools registered:", {
    calculator: !!calculatorTool,
    tavilySearch: !!tavilySearchTool
  });
  
  // Log the tool definitions safely
  try {
    const calculatorInfo = JSON.parse(JSON.stringify(calculatorTool));
    const tavilyInfo = JSON.parse(JSON.stringify(tavilySearchTool));
    
    console.log("[API Route] Calculator tool info:", {
      description: calculatorInfo.description?.substring(0, 50) + '...',
      parameters: Object.keys(calculatorInfo.parameters?.shape || {})
    });
    
    console.log("[API Route] Tavily tool info:", {
      description: tavilyInfo.description?.substring(0, 50) + '...',
      parameters: Object.keys(tavilyInfo.parameters?.shape || {})
    });
  } catch (e) {
    console.error("[API Route] Error logging tool info:", e);
  }

  // Return the data stream response
  return result.toDataStreamResponse();
}