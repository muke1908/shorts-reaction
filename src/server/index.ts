import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../config/env";
import type { PipelineConfig } from "../shared/types";
import { createApiRouter } from "./api";

export async function startServer(config: PipelineConfig): Promise<void> {
  const app = express();
  const uiDist = resolve(process.cwd(), "ui-dist");

  app.use("/api", createApiRouter(config));
  app.use("/generated", express.static(config.generatedDir));

  if (existsSync(uiDist)) {
    app.use(express.static(uiDist));
    app.get("*", (_request, response) => {
      response.sendFile(resolve(uiDist, "index.html"));
    });
  } else {
    app.get("/", (_request, response) => {
      response.type("html").send(`
        <html>
          <body style="font-family: sans-serif; padding: 24px;">
            <h1>UI build not found</h1>
            <p>Run <code>npm run build</code> to generate the React UI, then reload this page.</p>
            <p>The API is already available at <code>/api/dump</code>.</p>
          </body>
        </html>
      `);
    });
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    response.status(500).json({ error: message });
  });

  await new Promise<void>((resolvePromise) => {
    app.listen(config.port, () => {
      console.log(`UI server listening on http://localhost:${config.port}`);
      resolvePromise();
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer(loadConfig()).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
