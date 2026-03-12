import { createRequire } from "node:module";
import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createScoutMcpConfig } from "./tools.js";
import { SCOUT_PROMPT } from "./prompt.js";

// Resolve cli.js from the SDK package at runtime
const require = createRequire(import.meta.url);
const sdkEntry = require.resolve("@anthropic-ai/claude-agent-sdk");
const CLI_PATH = path.join(path.dirname(sdkEntry), "cli.js");

type Logger = (line: string) => void;

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
  const inner = message.message as Record<string, unknown> | undefined;
  const content = (inner?.content ?? message.content) as
    | Array<Record<string, unknown>>
    | undefined;
  if (
    (message.type === "assistant" || message.type === "user") &&
    Array.isArray(content)
  ) {
    for (const block of content) {
      if (block.type === "thinking") continue;
      else if (block.type === "text" && typeof block.text === "string") {
        const text = block.text as string;
        if (text === "Tool loaded.") continue;
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
        const resultContent =
          typeof block.content === "string"
            ? block.content
            : JSON.stringify(block.content ?? "");
        if (block.is_error) {
          log(`[Scout] !! ${resultContent.slice(0, 200)}`);
        } else {
          log(
            `[Scout] <- ${resultContent.length > 150 ? resultContent.slice(0, 150) + "..." : resultContent}`,
          );
        }
      } else if (block.type === "tool_reference") continue;
    }
    return;
  }
}

export async function runScoutCycle(
  config: {
    scoutId: string;
    baseUrl: string;
    apiKey: string;
    signal?: AbortSignal;
  },
  log: Logger = console.log,
): Promise<void> {
  const start = Date.now();
  const prefix = `[${config.scoutId}]`;
  const prefixedLog: Logger = (line) => log(`${prefix} ${line}`);

  prefixedLog(`Starting cycle -- ${new Date().toISOString()}`);

  const mcpServers = createScoutMcpConfig(config.baseUrl, config.apiKey);
  const signal = config.signal;

  // Route through AI Gateway if configured
  const env: Record<string, string> = {};
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  if (gatewayKey) {
    env.ANTHROPIC_BASE_URL = "https://ai-gateway.vercel.sh";
    env.ANTHROPIC_AUTH_TOKEN = gatewayKey;
    env.ANTHROPIC_API_KEY = "";
    prefixedLog("[Scout] Using Vercel AI Gateway");
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
        pathToClaudeCodeExecutable: CLI_PATH,
        systemPrompt: SCOUT_PROMPT,
        mcpServers,
        env,
        allowedTools: ["WebSearch", "WebFetch", "mcp__openlattice__*"],
        maxTurns: 40,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
      },
    })) {
      if (signal?.aborted) {
        prefixedLog("[Scout] Cancelled");
        break;
      }
      handleMessage(message as Record<string, unknown>, prefixedLog);
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (signal?.aborted) {
      prefixedLog("[Scout] Cancelled");
    } else {
      prefixedLog(`[Scout] Error: ${errMsg}`);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  prefixedLog(`[Scout] Cycle complete in ${elapsed}s`);
}
