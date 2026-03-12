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
        // Inherit PATH/HOME so npx can resolve — specifying env replaces
        // the process environment, so without these the subprocess can't
        // find binaries.
        PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
        HOME: process.env.HOME ?? "/tmp",
        OPENLATTICE_URL: baseUrl,
        OPENLATTICE_API_KEY: apiKey,
      },
    },
  };
}
