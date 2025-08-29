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
      hasToolCallList: !!body.message?.toolCallList,
      toolCallCount: body.message?.toolCallList?.length || 0,
      fullBody: JSON.stringify(body, null, 2)
    });

    // Check if this is a tool-calls message
    if (body.message?.type !== 'tool-calls') {
      console.log("[Voice Functions API] Not a tool-calls message, ignoring");
      return NextResponse.json({ success: true });
    }

    // Extract tool calls from Vapi webhook format
    const toolCallList = body.message?.toolCallList;
    
    if (!toolCallList || toolCallList.length === 0) {
      console.error("[Voice Functions API] No tool calls found in request");
      return NextResponse.json({
        results: [{
          error: "No tool calls found in request"
        }]
      }, { status: 400 });
    }

    // Process all tool calls
    const results = await Promise.all(
      toolCallList.map(async (toolCall: any) => {
        const { id, name, arguments: args } = toolCall;
        
        console.log(`[Voice Functions API] Executing tool: ${name}`, {
          toolCallId: id,
          arguments: JSON.stringify(args, null, 2)
        });

        try {
          // Execute the function
          const result = await executeToolByName(name, args);
          
          console.log(`[Voice Functions API] Tool ${name} result:`, {
            toolCallId: id,
            result: JSON.stringify(result, null, 2),
            hasError: 'error' in result
          });

          // Return in Vapi's expected format with toolCallId
          return {
            toolCallId: id,
            result: typeof result === 'object' ? JSON.stringify(result) : String(result)
          };
        } catch (error) {
          console.error(`[Voice Functions API] Error executing tool ${name}:`, error);
          return {
            toolCallId: id,
            result: JSON.stringify({
              error: error instanceof Error ? error.message : "Unknown error occurred"
            })
          };
        }
      })
    );
    
    const response = { results };
    
    console.log("[Voice Functions API] Sending response:", JSON.stringify(response, null, 2));
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("[Voice Functions API] Error handling request:", error);
    
    return NextResponse.json({
      results: [{
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }]
    }, { status: 500 });
  }
}