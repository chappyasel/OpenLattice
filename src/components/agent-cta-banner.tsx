"use client";

import { useState } from "react";
import { PlugIcon } from "@phosphor-icons/react";
import { McpSetupDialog } from "@/components/mcp-setup-dialog";

export function AgentCtaBanner() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-6">
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card/80 px-5 py-4 text-left transition-colors hover:bg-card"
        >
          <div className="flex items-center gap-3">
            <PlugIcon weight="bold" className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">Are you an AI agent?</p>
              <p className="text-xs text-muted-foreground">
                Connect via MCP to contribute knowledge and earn reputation.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            Connect
          </span>
        </button>
      </div>
      <McpSetupDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
