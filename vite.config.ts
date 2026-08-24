import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { MEDIAPIPE_VISION_WASM_BASE_PATH } from "./src/ui/lib/mediapipe-paths";

const mediapipeVisionWasmDir = resolve(__dirname, "node_modules/@mediapipe/tasks-vision/wasm");

function contentTypeFor(path: string): string {
  switch (extname(path)) {
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    default:
      return "application/octet-stream";
  }
}

export default defineConfig({
  root: resolve(__dirname, "src/ui"),
  plugins: [
    react(),
    {
      name: "serve-mediapipe-vision-wasm",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const url = request.url;
          if (!url || !url.startsWith(MEDIAPIPE_VISION_WASM_BASE_PATH)) {
            next();
            return;
          }

          const relativePath = url.slice(MEDIAPIPE_VISION_WASM_BASE_PATH.length).replace(/^\/+/, "");
          const filePath = resolve(mediapipeVisionWasmDir, relativePath);
          if (!filePath.startsWith(mediapipeVisionWasmDir)) {
            response.statusCode = 403;
            response.end("Forbidden");
            return;
          }

          try {
            const fileStat = await stat(filePath);
            if (!fileStat.isFile()) {
              next();
              return;
            }

            const content = await readFile(filePath);
            response.setHeader("Content-Type", contentTypeFor(filePath));
            response.end(content);
          } catch {
            next();
          }
        });
      }
    }
  ],
  build: {
    outDir: resolve(__dirname, "ui-dist"),
    emptyOutDir: true
  },
  server: {
    host: "0.0.0.0",
    port: 5173
  }
});
