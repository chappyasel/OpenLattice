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

// Max time a single scout cycle can run before being force-terminated
const CYCLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Inactivity timeout — if no messages arrive for this long, assume the stream is stuck
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

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
  const env: Record<string, string> = {
    // Allow long-running tool calls (web searches, MCP) without the SDK
    // killing the stream on its default 60s inactivity timeout
    CLAUDE_CODE_STREAM_CLOSE_TIMEOUT: "300",
  };
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  if (gatewayKey) {
    env.ANTHROPIC_BASE_URL = "https://ai-gateway.vercel.sh";
    env.ANTHROPIC_AUTH_TOKEN = gatewayKey;
    env.ANTHROPIC_API_KEY = "";
    prefixedLog("[Scout] Using Vercel AI Gateway");
  }

  // Dedicated abort controller so we can kill the query subprocess on timeout
  const queryAbort = new AbortController();

  // Forward the external cancellation signal
  if (signal) {
    signal.addEventListener("abort", () => queryAbort.abort(), { once: true });
  }

  try {
    const queryOptions: Record<string, unknown> = {
      pathToClaudeCodeExecutable: CLI_PATH,
      systemPrompt: SCOUT_PROMPT,
      mcpServers,
      allowedTools: ["WebSearch", "WebFetch", "mcp__openlattice__*"],
      maxTurns: 40,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      abortController: queryAbort,
      env,
      stderr: (data: string) => {
        prefixedLog(`[Scout:stderr] ${data.trim()}`);
      },
    };

    const queryIterable = query({
      prompt:
        "Run a contribution cycle for OpenLattice. " +
        "First check for revision requests and address any feedback. " +
        "Then browse bounties, pick the best one, research the topic thoroughly using web search, " +
        "and submit a high-quality expansion with real, verified resources. " +
        "If time permits, work on additional bounties.",
      options: queryOptions as Parameters<typeof query>[0]["options"],
    });

    // Wrap the async iteration with both a hard cycle timeout and an
    // inactivity watchdog so a stalled stream can't freeze the scout forever.
    let lastMessageAt = Date.now();

    const iterationPromise = (async () => {
      for await (const message of queryIterable) {
        lastMessageAt = Date.now();
        if (signal?.aborted) {
          prefixedLog("[Scout] Cancelled");
          break;
        }
        handleMessage(message as Record<string, unknown>, prefixedLog);
      }
    })();

    const timeoutPromise = new Promise<"cycle-timeout" | "inactivity-timeout">(
      (resolve) => {
        const cycleTimer = setTimeout(
          () => resolve("cycle-timeout"),
          CYCLE_TIMEOUT_MS,
        );

        // Check for inactivity periodically
        const inactivityCheck = setInterval(() => {
          if (Date.now() - lastMessageAt > INACTIVITY_TIMEOUT_MS) {
            clearTimeout(cycleTimer);
            clearInterval(inactivityCheck);
            resolve("inactivity-timeout");
          }
        }, 10_000);

        // Clean up timers if the iteration finishes normally
        iterationPromise.finally(() => {
          clearTimeout(cycleTimer);
          clearInterval(inactivityCheck);
        });
      },
    );

    const result = await Promise.race([
      iterationPromise.then(() => "done" as const),
      timeoutPromise,
    ]);

    if (result === "cycle-timeout") {
      prefixedLog(
        `[Scout] Cycle timeout (${CYCLE_TIMEOUT_MS / 1000}s) — force-terminating`,
      );
      queryAbort.abort();
    } else if (result === "inactivity-timeout") {
      prefixedLog(
        `[Scout] Inactivity timeout (${INACTIVITY_TIMEOUT_MS / 1000}s since last message) — force-terminating`,
      );
      queryAbort.abort();
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
