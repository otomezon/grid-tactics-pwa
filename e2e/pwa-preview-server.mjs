import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { preview } from "vite";

let updateRevision = 0;

const server = await preview({
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true
  },
  plugins: [
    {
      name: "pwa-e2e-service-worker-update",
      configurePreviewServer(previewServer) {
        previewServer.middlewares.use("/__test/force-sw-update", (request, response) => {
          if (request.method !== "POST") {
            response.statusCode = 405;
            response.end("Method not allowed");
            return;
          }

          updateRevision += 1;
          void appendFile(
            resolve("dist/sw.js"),
            "\n// Playwright service-worker update " + updateRevision + "\n"
          ).then(() => {
            response.statusCode = 204;
            response.end();
          }).catch((error) => {
            response.statusCode = 500;
            response.end(error instanceof Error ? error.message : "Could not update service worker.");
          });
        });
      }
    }
  ]
});

server.printUrls();
