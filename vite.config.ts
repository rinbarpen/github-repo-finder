import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative assets also work at https://owner.github.io/repository/.
  base: "./",
  build: { outDir: "dist" },
});
