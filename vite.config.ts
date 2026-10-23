import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

function expressApiPlugin(): Plugin {
  return {
    name: "studymate-express-api",
    async configureServer(server) {
      const { createBackendApp } = await import("./src/backend/app");
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
    nitro(),
    viteReact(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/react-router",
    ],
  },
});
