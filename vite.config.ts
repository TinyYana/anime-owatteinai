import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Frontend-only build. The Worker (src/worker) is bundled by Wrangler.
// `vite build` emits the SPA into dist/client, which Wrangler serves as static assets.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
  server: {
    // `pnpm dev:web` runs the SPA with HMR and proxies /api to `wrangler dev`.
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
