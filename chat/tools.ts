import { tool } from "ai";
import { z } from "zod";
import { TavilyClient } from "tavily";

// Helper function to add a small delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const calculatorTool = tool({
  description: "Perform arithmetic calculations with two numbers",
  parameters: z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]).describe("The arithmetic operation to perform"),
    a: z.number().describe("The first number"),
    b: z.number().describe("The second number"),
  }),
  execute: async ({ operation, a, b }) => {
    // Add a small delay to ensure the UI has time to show the "thinking" state
    await delay(1000);
    
    switch (operation) {
      case "add":
        return { result: a + b };
      case "subtract":
        return { result: a - b };
      case "multiply":
        return { result: a * b };
      case "divide":
        if (b === 0) return { error: "Cannot divide by zero" };
        return { result: a / b };
    }
  },
});

export const tavilySearchTool = tool({
  description: "Search the web for current information using Tavily search API",
  parameters: z.object({
    query: z.string().describe("The search query"),
    search_depth: z.enum(["basic", "advanced"]).optional().describe("The depth of search to perform"),
    include_domains: z.array(z.string()).optional().describe("Specific domains to include in the search"),
    exclude_domains: z.array(z.string()).optional().describe("Specific domains to exclude from the search"),
    max_results: z.number().optional().describe("Maximum number of results to return"),
    include_answer: z.boolean().optional().describe("Whether to include an AI-generated answer"),
    include_raw_content: z.boolean().optional().describe("Whether to include raw content from the search results"),
  }),
  execute: async ({ query, search_depth = "basic", include_domains, exclude_domains, max_results, include_answer, include_raw_content }) => {
    try {
      // Add a small delay to ensure the UI has time to show the "thinking" state
      await delay(500);
      
      console.log("[Tavily] Search request:", { 
        query, 
        search_depth, 
        include_domains, 
        exclude_domains, 
        max_results, 
        include_answer, 
        include_raw_content 
      });
      
      // Initialize the Tavily client with API key from environment variables
      const tavily = new TavilyClient(); // api key defaults to "TAVILY_API_KEY" env var
      console.log("[Tavily] API Key present:", !!process.env.TAVILY_API_KEY);
      
      // Perform the search
      const searchResult = await tavily.search({
        query,
        search_depth,
        include_domains,
        exclude_domains,
        max_results,
        include_answer,
        include_raw_content,
      });
      
      console.log("[Tavily] Search response:", JSON.stringify(searchResult).substring(0, 200) + "...");
      
      return searchResult;
    } catch (error) {
      console.error("[Tavily] Search error:", error);
      return { error: "Failed to perform search. Please check your Tavily API key or try again later." };
    }
  },
}); 