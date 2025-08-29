import { system_prompt } from "@/chat/prompt";
import { calculatorTool, tavilySearchTool } from "@/chat/tools";

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

    functions: [
      {
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
      {
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
      }
    ],
  },
  firstMessage:
    "Hey there! How can I assist you today?",
};
