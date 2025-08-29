import { tool } from "ai";
import { z } from "zod";
import { TavilyClient } from "tavily";

// Helper function to add a small delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Input must be a JSON Schema object for OpenAI tools.
// We support either an expression or structured args via optional fields.
const CalculatorInputSchema = z
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
  );

const CalculatorOutputSchema = z.union([
  z.object({ result: z.number() }),
  z.object({ error: z.string() }),
]);

export const calculatorTool = tool({
  description:
    "Perform arithmetic on two numbers. Pass either { operation, a, b } or an { expression } like '234234234-423'.",
  inputSchema: CalculatorInputSchema,
  outputSchema: CalculatorOutputSchema,
  execute: async (args: z.infer<typeof CalculatorInputSchema>) => {
    // Add a small delay to ensure the UI has time to show the "thinking" state
    await delay(1000);

    // Allow either structured args or a free-form expression
    if (args.expression != null && args.expression !== undefined) {
      const expr = args.expression.trim();
      // Support simple binary expressions: a op b (with optional spaces)
      const m = expr.match(/^\s*(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (!m) {
        return { error: "Unsupported expression. Use simple forms like 2+2 or 3 * 7." } as const;
      }
      const a = Number(m[1]);
      const op = m[2];
      const b = Number(m[3]);
      switch (op) {
        case "+":
          return { result: a + b } as const;
        case "-":
          return { result: a - b } as const;
        case "*":
          return { result: a * b } as const;
        case "/":
          if (b === 0) return { error: "Cannot divide by zero" } as const;
          return { result: a / b } as const;
        default:
          return { error: "Unknown operator" } as const;
      }
    }
    const { operation, a, b } = args;
    if (!operation || a === undefined || b === undefined) {
      return { error: "Provide either an 'expression' or 'operation', 'a', and 'b'." } as const;
    }
    switch (operation) {
      case "add":
        return { result: a + b } as const;
      case "subtract":
        return { result: a - b } as const;
      case "multiply":
        return { result: a * b } as const;
      case "divide":
        if (b === 0) return { error: "Cannot divide by zero" } as const;
        return { result: a / b } as const;
      default:
        return { error: "Unknown operation" } as const;
    }
  },
});

const TavilyInputSchema = z.object({
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
});

export const tavilySearchTool = tool({
  description:
    "Search the web for current information using Tavily search API",
  inputSchema: TavilyInputSchema,
  execute: async (args: z.infer<typeof TavilyInputSchema>) => {
    try {
      // Add a small delay to ensure the UI has time to show the "thinking" state
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

      // Initialize the Tavily client with API key from environment variables
      const tavily = new TavilyClient(); // api key defaults to "TAVILY_API_KEY" env var
      console.log("[Tavily] API Key present:", !!process.env.TAVILY_API_KEY);

      // Perform the search
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
  },
});
