import "./lib/error-capture";

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

function ensureNodeGlobalsForBundledCjs(): void {
  const g = globalThis as Record<string, unknown>;
  try {
    const currentFile = fileURLToPath(import.meta.url);
    if (typeof g["__filename"] === "undefined") {
      g["__filename"] = currentFile;
    }
    if (typeof g["__dirname"] === "undefined") {
      g["__dirname"] = path.dirname(currentFile);
    }
    if (typeof g["require"] === "undefined") {
      g["require"] = createRequire(import.meta.url);
    }
  } catch {
    // ignore if import.meta.url is not a file:// URL
  }
}

ensureNodeGlobalsForBundledCjs();

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
let webApiHandlerPromise: Promise<(request: Request) => Promise<Response>> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function getWebApiHandler(): Promise<(request: Request) => Promise<Response>> {
  if (!webApiHandlerPromise) {
    webApiHandlerPromise = import("./backend/web-handler").then((m) => m.handleWebApiRequest);
  }
  return webApiHandlerPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        const handleWebApiRequest = await getWebApiHandler();
        return await handleWebApiRequest(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      const isApi = new URL(request.url).pathname.startsWith("/api");
      if (isApi) {
        return new Response(
          JSON.stringify({
            error: {
              code: "INTERNAL_ERROR",
              message: error instanceof Error ? error.message : String(error),
            },
          }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          },
        );
      }
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
