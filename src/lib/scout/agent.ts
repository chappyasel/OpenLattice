/**
 * Scout contributor agent cycle.
 *
 * Uses @anthropic-ai/claude-agent-sdk `query()` to give Scout autonomy
 * over the contribution process via MCP tools + built-in web search.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { createScoutMcpConfig } from "./tools";
import { SCOUT_PROMPT } from "./prompt";
import type { Logger, CycleResult } from "@/lib/evaluator/cycle";

// ─── Message Handling ────────────────────────────────────────────────────

function handleMessage(message: Record<string, unknown>, log: Logger) {
  if ("result" in message && typeof message.result === "string") {
    log(`[Scout] ${message.result}`);
    return;
  }

  if (message.type === "system") {
    if (message.subtype === "init") {
      log(`[Scout] Session initialized (id: ${message.session_id})`);
    }
    return;
  }

  // Agent SDK wraps content in message.message.content
  const inner = message.message as Record<string, unknown> | undefined;
  const content = (inner?.content ?? message.content) as
    | Array<Record<string, unknown>>
    | undefined;

  if ((message.type === "assistant" || message.type === "user") && Array.isArray(content)) {
    for (const block of content) {
      if (block.type === "thinking") {
        // Skip thinking blocks — too verbose
        continue;
      } else if (block.type === "text" && typeof block.text === "string") {
        const text = block.text as string;
        if (text === "Tool loaded.") continue; // noise
        const lines = text.split("\n").filter((l: string) => l.trim());
        for (const line of lines.slice(0, 10)) {
          log(`[Scout] ${line}`);
        }
        if (lines.length > 10) {
          log(`[Scout] ... (${lines.length - 10} more lines)`);
        }
      } else if (block.type === "tool_use") {
        const name = block.name as string;
        const input = JSON.stringify(block.input ?? {});
        log(
          `[Scout] -> ${name}(${input.length > 120 ? input.slice(0, 120) + "..." : input})`,
        );
      } else if (block.type === "tool_result") {
        const resultContent = typeof block.content === "string"
          ? block.content
          : JSON.stringify(block.content ?? "");
        if (block.is_error) {
          log(`[Scout] !! ${resultContent.slice(0, 200)}`);
        } else {
          log(
            `[Scout] <- ${resultContent.length > 150 ? resultContent.slice(0, 150) + "..." : resultContent}`,
          );
        }
      } else if (block.type === "tool_reference") {
        // Tool discovery — skip noise
        continue;
      }
    }
    return;
  }
}

// ─── Main Entry Point ────────────────────────────────────────────────────

export async function runScoutCycle(
  config: {
    baseUrl: string;
    apiKey: string;
    signal?: AbortSignal;
  },
  log: Logger = console.log,
): Promise<CycleResult> {
  const start = Date.now();

  log(
    `\n${"=".repeat(60)}\n[Scout] Cycle -- ${new Date().toISOString()}\n${"=".repeat(60)}`,
  );

  const mcpServers = createScoutMcpConfig(config.baseUrl, config.apiKey);

  const signal = config.signal;

  // Route through Vercel AI Gateway if configured
  const env: Record<string, string> = {};
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  if (gatewayKey) {
    env.ANTHROPIC_BASE_URL = "https://ai-gateway.vercel.sh";
    env.ANTHROPIC_AUTH_TOKEN = gatewayKey;
    env.ANTHROPIC_API_KEY = "";
    log("[Scout] Using Vercel AI Gateway");
  }

  try {
    for await (const message of query({
      prompt:
        "Run a contribution cycle for OpenLattice. " +
        "First check for revision requests and address any feedback. " +
        "Then browse bounties, pick the best one, research the topic thoroughly using web search, " +
        "and submit a high-quality expansion with real, verified resources. " +
        "If time permits, work on additional bounties.",
      options: {
        systemPrompt: SCOUT_PROMPT,
        mcpServers,
        env,
        allowedTools: [
          "WebSearch",
          "WebFetch",
          "mcp__openlattice__*",
        ],
        maxTurns: 40,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
      },
    })) {
      if (signal?.aborted) {
        log("[Scout] Cancelled");
        break;
      }
      handleMessage(message as Record<string, unknown>, log);
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (signal?.aborted) {
      log("[Scout] Cancelled");
    } else {
      log(`[Scout] Error: ${errMsg}`);
    }
  }

  const durationMs = Date.now() - start;
  const elapsed = (durationMs / 1000).toFixed(1);
  log(`\n[Scout] Cycle complete in ${elapsed}s`);

  return {
    reviewed: 0,
    resourcesReviewed: 0,
    scored: 0,
    bountiesPosted: 0,
    durationMs,
  };
}
