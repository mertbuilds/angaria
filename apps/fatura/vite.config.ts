import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { apiPlugin } from "./server/api.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin()],
});
