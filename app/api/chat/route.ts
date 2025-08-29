import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage, stepCountIs } from "ai";
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
    tools: {
      calculator: calculatorTool,
      tavilySearch: tavilySearchTool
    },
    stopWhen: stepCountIs(5), // Allow multi-step tool calls
    onStepFinish: ({ text, toolCalls, toolResults, finishReason }) => {
      console.log("[API Route] Step finished:", {
        hasText: !!text,
        textLength: text?.length,
        toolCallsCount: toolCalls?.length,
        toolResultsCount: toolResults?.length,
        finishReason
      });
      if (toolCalls?.length > 0) {
        console.log("[API Route] Tool calls made:", toolCalls.map(tc => ({
          toolName: tc.toolName,
          input: tc.input
        })));
      }
      if (toolResults?.length > 0) {
        console.log("[API Route] Tool results:", toolResults);
      }
    }
  });

  console.log("[API Route] Tools registered:", {
    calculator: !!calculatorTool,
    tavilySearch: !!tavilySearchTool
  });
  
  // Log the tool definitions safely
  try {
    console.log("[API Route] Calculator tool info:", {
      description: calculatorTool.description?.substring(0, 50) + "...",
    });
    console.log("[API Route] Tavily tool info:", {
      description: tavilySearchTool.description?.substring(0, 50) + "...",
    });
  } catch (e) {
    console.error("[API Route] Error logging tool info:", e);
  }

  // Return the stream as UI message response  
  return result.toUIMessageStreamResponse();
}
