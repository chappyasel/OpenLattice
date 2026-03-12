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
