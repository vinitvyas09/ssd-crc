/**
 * API endpoint for Vapi function execution
 * Handles function calls from the Vapi voice assistant
 */
import { NextRequest, NextResponse } from "next/server";
import { executeToolByName } from "@/tools/unified-tools";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log("[Voice Functions API] Received request:", {
      timestamp: new Date().toISOString(),
      messageType: body.message?.type,
      hasToolCalls: !!body.message?.toolCalls,
      toolCallCount: body.message?.toolCalls?.length || 0
    });

    // Check if this is a tool-calls message
    if (body.message?.type !== 'tool-calls') {
      console.log("[Voice Functions API] Not a tool-calls message, type:", body.message?.type);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Extract tool calls from Vapi webhook format (using toolCalls, not toolCallList)
    const toolCalls = body.message?.toolCalls;
    
    if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
      console.error("[Voice Functions API] No tool calls found in request");
      return NextResponse.json({
        error: "No tool calls found in request"
      }, { status: 400 });
    }

    console.log("[Voice Functions API] Processing tool calls:", JSON.stringify(toolCalls, null, 2));

    // Process all tool calls
    const results = [];
    
    for (const toolCall of toolCalls) {
      const toolCallId = toolCall.id || 'tool_call_id';
      const functionName = toolCall.function?.name;
      const functionArgs = toolCall.function?.arguments || {};
      
      if (!functionName) {
        console.error("[Voice Functions API] Function name not found in tool call:", toolCall);
        results.push({
          toolCallId,
          result: { error: "Function name missing" }
        });
        continue;
      }
      
      console.log(`[Voice Functions API] Executing function: ${functionName}`, {
        toolCallId,
        arguments: JSON.stringify(functionArgs, null, 2)
      });

      try {
        // Execute the function
        const result = await executeToolByName(functionName, functionArgs);
        
        console.log(`[Voice Functions API] Function ${functionName} result:`, {
          toolCallId,
          result: JSON.stringify(result, null, 2)
        });

        // Return in Vapi's expected format with toolCallId
        results.push({
          toolCallId,
          result: typeof result === 'object' ? JSON.stringify(result) : String(result)
        });
      } catch (error) {
        console.error(`[Voice Functions API] Error executing function ${functionName}:`, error);
        results.push({
          toolCallId,
          result: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error occurred"
          })
        });
      }
    }
    
    const response = { results };
    
    console.log("[Voice Functions API] Sending response:", JSON.stringify(response, null, 2));
    
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[Voice Functions API] Error handling request:", error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal Server Error"
    }, { status: 500 });
  }
}