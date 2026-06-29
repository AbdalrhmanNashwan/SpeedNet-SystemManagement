import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    host: true,
    // allow access via tunnel hostnames (e.g. *.trycloudflare.com) during testing
    allowedHosts: true,
    proxy: { "/api": "http://localhost:8000" },
  },
});
