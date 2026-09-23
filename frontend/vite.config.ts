import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  // react() was missing, which cost Fast Refresh: esbuild still compiled JSX, so the app ran,
  // but every edit did a full reload and lost component state.
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Dev serves the app and the API from one origin, so the browser never makes a cross-origin
    // request and the API needs no CORS setup. A deployed build sets VITE_API_BASE_URL instead.
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/health": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
