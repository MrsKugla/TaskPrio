import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Porta fissa: tauri.conf.json punta a devUrl http://localhost:1420.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: "es2022" },
});
