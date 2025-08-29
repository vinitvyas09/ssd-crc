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
      functionName: body.message?.functionCall?.name,
      parameters: body.message?.functionCall?.parameters,
      fullBody: JSON.stringify(body, null, 2)
    });

    // Extract function call details from Vapi webhook format
    const functionCall = body.message?.functionCall;
    
    if (!functionCall) {
      console.error("[Voice Functions API] No function call found in request");
      return NextResponse.json({
        results: [{
          error: "No function call found in request"
        }]
      }, { status: 400 });
    }

    const { name, parameters } = functionCall;
    
    console.log(`[Voice Functions API] Executing function: ${name}`, {
      parameters: JSON.stringify(parameters, null, 2)
    });

    // Execute the function
    const result = await executeToolByName(name, parameters);
    
    console.log(`[Voice Functions API] Function ${name} result:`, {
      result: JSON.stringify(result, null, 2),
      hasError: 'error' in result
    });

    // Return in Vapi's expected format
    const response = {
      results: [{
        name,
        result: typeof result === 'object' ? JSON.stringify(result) : String(result)
      }]
    };
    
    console.log("[Voice Functions API] Sending response:", JSON.stringify(response, null, 2));
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("[Voice Functions API] Error handling function call:", error);
    
    return NextResponse.json({
      results: [{
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }]
    }, { status: 500 });
  }
}