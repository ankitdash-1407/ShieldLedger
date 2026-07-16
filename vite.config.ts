// @lovable.dev/vite-tanstack-config already includes everything needed.
// Only keep the one import that handles the base configuration.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Node.js preset so pg + @aws-sdk/client-bedrock-runtime work at runtime.
  nitro: {
    preset: "node-server",
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts.
    server: { entry: "server" },
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
});
