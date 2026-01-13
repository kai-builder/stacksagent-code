import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { tools, systemPrompt } from "@/lib/tools";
import { executeTool } from "@/lib/stacks-api";

// Type definitions for Claude API responses
interface TextBlock {
  type: "text";
  text: string;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

type ContentBlock = TextBlock | ToolUseBlock;

interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

interface ToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

/**
 * POST /api/chat
 * Handle chat messages with Claude API and tool execution
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [] } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "ANTHROPIC_API_KEY is not configured. Please add it to your .env file.",
        },
        { status: 500 }
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({ apiKey });

    // Build conversation history
    const messages: Message[] = [...history];
    messages.push({ role: "user", content: message });

    // Initial API call
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools: tools,
      messages: messages as Anthropic.MessageParam[],
    });

    // Handle tool use loop
    while (response.stop_reason === "tool_use") {
      // Find all tool use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) break;

      // Execute all tool calls in parallel
      const toolResults: ToolResult[] = await Promise.all(
        toolUseBlocks.map(async (toolUse) => {
          console.log(`[Tool] Executing: ${toolUse.name}`, toolUse.input);
          const result = await executeTool(
            toolUse.name,
            toolUse.input as Record<string, unknown>
          );
          console.log(`[Tool] Result for ${toolUse.name}:`, result.substring(0, 200));
          return {
            type: "tool_result" as const,
            tool_use_id: toolUse.id,
            content: result,
          };
        })
      );

      // Add assistant response and tool results to history
      messages.push({
        role: "assistant",
        content: response.content as ContentBlock[],
      });
      messages.push({
        role: "user",
        content: toolResults as unknown as ContentBlock[],
      });

      // Continue conversation with tool results
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        tools: tools,
        messages: messages as Anthropic.MessageParam[],
      });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const assistantMessage = textBlocks.map((b) => b.text).join("\n") || "";

    // Add final assistant response to history
    messages.push({
      role: "assistant",
      content: response.content as ContentBlock[],
    });

    // Return response with simplified history for the client
    const simplifiedHistory = messages.map((msg) => {
      if (typeof msg.content === "string") {
        return msg;
      }
      // For assistant messages with tool use, extract just the text
      if (msg.role === "assistant") {
        const textContent = (msg.content as ContentBlock[])
          .filter((b): b is TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        return { role: msg.role, content: textContent || "[Processing...]" };
      }
      // For user messages with tool results, skip them in UI history
      return null;
    }).filter((msg): msg is Message => msg !== null && msg.content !== "");

    return NextResponse.json({
      success: true,
      message: assistantMessage,
      history: simplifiedHistory,
    });
  } catch (error) {
    console.error("[Chat API Error]", error);

    // Handle specific Anthropic errors
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { success: false, error: "Invalid API key. Please check your ANTHROPIC_API_KEY." },
          { status: 401 }
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { success: false, error: "Rate limited. Please wait a moment and try again." },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
