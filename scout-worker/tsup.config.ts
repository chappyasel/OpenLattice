import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  dts: false,
  sourcemap: true,
  // Keep SDK as external so its cli.js resolution works via node_modules
  external: ["@anthropic-ai/claude-agent-sdk"],
});
