import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In Docker: VITE_API_TARGET=http://server:5050 (Docker network hostname)
// Locally:   defaults to http://localhost:5050
const API_TARGET = process.env.VITE_API_TARGET || "http://localhost:5050";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target:       API_TARGET,
        changeOrigin: true,
        // Needed for SSE (EventSource) to work through the proxy
        configure: (proxy) => {
          proxy.on("proxyReq", (_, req) => {
            if (req.headers.accept?.includes("text/event-stream")) {
              // Let the connection stay open for SSE
            }
          });
        },
      },
    },
  },
});
