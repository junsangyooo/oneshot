import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@oneshot/shared": path.resolve(currentDir, "../shared/src/index.ts"),
      "@": path.resolve(currentDir, "src"),
    },
  },
  server: {
    port: 5173,
  },
});
