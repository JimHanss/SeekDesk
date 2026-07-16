import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(directory, "src", "desktop"),
  build: {
    outDir: path.resolve(directory, ".vite", "renderer", "main_window"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(directory, "src", "desktop", "index.html")
    }
  }
});
