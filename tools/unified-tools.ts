/**
 * Unified tool definitions that can be used by both Vercel AI SDK (chat) and Vapi (voice).
 * This provides a single source of truth for tool definitions with adapters for each platform.
 */

import { z } from "zod";
import { tool } from "ai";
import { TavilyClient } from "tavily";

// Helper function for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// UNIFIED TOOL DEFINITIONS
// ============================================

/**
 * Unified Calculator Tool Definition
 */
export const CALCULATOR_TOOL = {
  name: "calculator",
  description: "Perform arithmetic calculations with two numbers or evaluate simple expressions",
  
  // Zod schema for Vercel AI SDK
  zodSchema: {
    input: z
      .object({
        expression: z
          .string()
          .optional()
          .describe(
            'A simple arithmetic expression like "2+2", "3 * 7", or "234234234-423"'
          ),
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .optional()
          .describe("The arithmetic operation to perform"),
        a: z.number().optional().describe("The first number"),
        b: z.number().optional().describe("The second number"),
      })
      .describe(
        "Provide either an 'expression' or the trio of 'operation', 'a', and 'b'."
      ),
    output: z.union([
      z.object({ result: z.number() }),
      z.object({ error: z.string() }),
    ])
  },
  
  // OpenAI function schema for Vapi
  openAISchema: {
    name: "calculator",
    description: "Perform arithmetic calculations with two numbers",
    parameters: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["add", "subtract", "multiply", "divide"],
          description: "The arithmetic operation to perform"
        },
        a: {
          type: "number",
          description: "The first number"
        },
        b: {
          type: "number",
          description: "The second number"
        }
      },
      required: ["operation", "a", "b"]
    }
  },
  
  // Shared execution logic
  execute: async (args: any) => {
    console.log("[Calculator Tool] Executing with args:", args);
    await delay(1000);
    
    // Handle expression format
    if (args.expression != null && args.expression !== undefined) {
      const expr = args.expression.trim();
      console.log("[Calculator Tool] Processing expression:", expr);
      const m = expr.match(/^\s*(-?\d+(?:\.\d+)?)\s*([\+\-*/])\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (!m) {
        console.error("[Calculator Tool] Invalid expression format:", expr);
        return { error: "Unsupported expression. Use simple forms like 2+2 or 3 * 7." } as const;
      }
      const a = Number(m[1]);
      const op = m[2];
      const b = Number(m[3]);
      console.log(`[Calculator Tool] Parsed: ${a} ${op} ${b}`);
      
      let result;
      switch (op) {
        case "+":
          result = { result: a + b } as const;
          break;
        case "-":
          result = { result: a - b } as const;
          break;
        case "*":
          result = { result: a * b } as const;
          break;
        case "/":
          if (b === 0) {
            console.error("[Calculator Tool] Division by zero attempted");
            return { error: "Cannot divide by zero" } as const;
          }
          result = { result: a / b } as const;
          break;
        default:
          console.error("[Calculator Tool] Unknown operator:", op);
          return { error: "Unknown operator" } as const;
      }
      console.log("[Calculator Tool] Expression result:", result);
      return result;
    }
    
    // Handle structured format
    const { operation, a, b } = args;
    console.log(`[Calculator Tool] Structured format: operation=${operation}, a=${a}, b=${b}`);
    
    if (!operation || a === undefined || b === undefined) {
      console.error("[Calculator Tool] Missing required parameters:", { operation, a, b });
      return { error: "Provide either an 'expression' or 'operation', 'a', and 'b'." } as const;
    }
    
    let result;
    switch (operation) {
      case "add":
        result = { result: a + b } as const;
        break;
      case "subtract":
        result = { result: a - b } as const;
        break;
      case "multiply":
        result = { result: a * b } as const;
        break;
      case "divide":
        if (b === 0) {
          console.error("[Calculator Tool] Division by zero attempted");
          return { error: "Cannot divide by zero" } as const;
        }
        result = { result: a / b } as const;
        break;
      default:
        console.error("[Calculator Tool] Unknown operation:", operation);
        return { error: "Unknown operation" } as const;
    }
    console.log("[Calculator Tool] Structured result:", result);
    return result;
  }
};

/**
 * Unified Tavily Search Tool Definition
 */
export const TAVILY_SEARCH_TOOL = {
  name: "tavilySearch",
  description: "Search the web for current information using Tavily search API",
  
  // Zod schema for Vercel AI SDK
  zodSchema: {
    input: z.object({
      query: z.string().describe("The search query"),
      search_depth: z.enum(["basic", "advanced"]).optional().describe(
        "The depth of search to perform"
      ),
      include_domains: z
        .array(z.string())
        .optional()
        .describe("Specific domains to include in the search"),
      exclude_domains: z
        .array(z.string())
        .optional()
        .describe("Specific domains to exclude from the search"),
      max_results: z
        .number()
        .optional()
        .describe("Maximum number of results to return"),
      include_answer: z
        .boolean()
        .optional()
        .describe("Whether to include an AI-generated answer"),
      include_raw_content: z
        .boolean()
        .optional()
        .describe("Whether to include raw content from the search results"),
    }),
    output: z.any() // Flexible output schema for search results
  },
  
  // OpenAI function schema for Vapi
  openAISchema: {
    name: "tavilySearch",
    description: "Search the web for current information using Tavily search API",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query"
        },
        search_depth: {
          type: "string",
          enum: ["basic", "advanced"],
          description: "The depth of search to perform"
        },
        include_domains: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Specific domains to include in the search"
        },
        exclude_domains: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Specific domains to exclude from the search"
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return"
        },
        include_answer: {
          type: "boolean",
          description: "Whether to include an AI-generated answer"
        },
        include_raw_content: {
          type: "boolean",
          description: "Whether to include raw content from the search results"
        }
      },
      required: ["query"]
    }
  },
  
  // Shared execution logic
  execute: async (args: any) => {
    try {
      await delay(500);
      
      const {
        query,
        search_depth,
        include_domains,
        exclude_domains,
        max_results,
        include_answer,
        include_raw_content,
      } = args;
      const resolvedDepth = search_depth ?? "basic";
      
      console.log("[Tavily] Search request:", {
        query,
        search_depth: resolvedDepth,
        include_domains,
        exclude_domains,
        max_results,
        include_answer,
        include_raw_content,
      });
      
      const tavily = new TavilyClient();
      console.log("[Tavily] API Key present:", !!process.env.TAVILY_API_KEY);
      
      const searchResult = await tavily.search({
        query,
        search_depth: resolvedDepth,
        include_domains,
        exclude_domains,
        max_results,
        include_answer,
        include_raw_content,
      });
      
      console.log(
        "[Tavily] Search response:",
        JSON.stringify(searchResult).substring(0, 200) + "..."
      );
      
      return searchResult;
    } catch (error) {
      console.error("[Tavily] Search error:", error);
      return {
        error:
          "Failed to perform search. Please check your Tavily API key or try again later.",
      } as const;
    }
  }
};

// ============================================
// ADAPTER FUNCTIONS
// ============================================

/**
 * Convert unified tool definitions to Vercel AI SDK format
 */
export function getVercelAITools() {
  return {
    calculatorTool: tool({
      description: CALCULATOR_TOOL.description,
      inputSchema: CALCULATOR_TOOL.zodSchema.input,
      execute: CALCULATOR_TOOL.execute as any,
    }),
    
    tavilySearchTool: tool({
      description: TAVILY_SEARCH_TOOL.description,
      inputSchema: TAVILY_SEARCH_TOOL.zodSchema.input,
      execute: TAVILY_SEARCH_TOOL.execute as any,
    })
  };
}

/**
 * Convert unified tool definitions to Vapi/OpenAI format
 */
export function getVapiFunctions() {
  return [
    CALCULATOR_TOOL.openAISchema,
    TAVILY_SEARCH_TOOL.openAISchema
  ];
}

/**
 * Execute a tool by name (for server-side function execution in Vapi)
 */
export async function executeToolByName(name: string, args: any) {
  console.log(`[ExecuteToolByName] Executing tool: ${name} with args:`, args);
  
  let result;
  switch (name) {
    case "calculator":
      result = await CALCULATOR_TOOL.execute(args);
      break;
    case "tavilySearch":
      result = await TAVILY_SEARCH_TOOL.execute(args);
      break;
    default:
      console.error(`[ExecuteToolByName] Unknown tool: ${name}`);
      result = { error: `Unknown tool: ${name}` };
  }
  
  console.log(`[ExecuteToolByName] Tool ${name} execution complete:`, result);
  return result;
}

// ============================================
// TYPE EXPORTS
// ============================================

export type CalculatorInput = z.infer<typeof CALCULATOR_TOOL.zodSchema.input>;
export type CalculatorOutput = z.infer<typeof CALCULATOR_TOOL.zodSchema.output>;
export type TavilySearchInput = z.infer<typeof TAVILY_SEARCH_TOOL.zodSchema.input>;