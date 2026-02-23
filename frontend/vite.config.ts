import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // Ensure Vite always treats the `frontend/` folder as the root
  // so `frontend/public/*` is served at `/`
  root: __dirname,
  publicDir: path.resolve(__dirname, "public"),

  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
