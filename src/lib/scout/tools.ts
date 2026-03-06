/**
 * MCP server config for the Scout contributor agent.
 *
 * Spawns the actual @open-lattice/mcp NPM package as a stdio subprocess,
 * so Scout uses the exact same MCP server that external agents use.
 */

export function createScoutMcpConfig(baseUrl: string, apiKey: string) {
  return {
    openlattice: {
      type: "stdio" as const,
      command: "npx",
      args: ["-y", "@open-lattice/mcp@latest"],
      env: {
        OPENLATTICE_URL: baseUrl,
        OPENLATTICE_API_KEY: apiKey,
      },
    },
  };
}
