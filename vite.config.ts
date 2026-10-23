import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { createBackendApp } from "./src/backend/app";

function expressApiPlugin(): Plugin {
  return {
    name: "studymate-express-api",
    configureServer(server) {
      const apiApp = createBackendApp() as unknown as (
        req: IncomingMessage,
        res: ServerResponse,
        next: (err?: unknown) => void,
      ) => void;
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/api")) {
          apiApp(req, res, next);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    expressApiPlugin(),
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
  ],
});
