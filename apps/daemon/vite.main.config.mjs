import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    outDir: path.resolve(directory, ".vite", "main")
  }
});
