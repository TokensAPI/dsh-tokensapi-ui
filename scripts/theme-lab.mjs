// Isolated, local-only theme exercise. All identities and API responses are fake.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { OrganizationThemeHost } from "../src/organization-theme-host.ts";
import { readCss } from "./read-css.mjs";

const root = new URL("../", import.meta.url);
const identities = { partner: 3, partner2: 3, other: 9, failure: 9, none: null };
let identity = "none";
let delayMs = 400;
let queryCount = 0;
let host = makeHost();

function makeHost() {
  return new OrganizationThemeHost(async () => identity === "none" ? "" : `sk-theme-lab-${identity}`, {
    // This function never sends a network request.
    fetch: (_url, options) => new Promise((resolve, reject) => {
      queryCount++;
      const selected = identity;
      const signal = options.signal;
      const aborted = () => { clearTimeout(timer); reject(new Error("simulated abort")); };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", aborted);
        if (selected === "failure") reject(new Error("simulated outage"));
        else resolve(Response.json({ success: true, data: { organization: { id: identities[selected], status: 1 } } }));
      }, delayMs);
      signal.addEventListener("abort", aborted, { once: true });
    }),
  });
}

const modules = new Set([
  "src/shared/organization-theme.ts",
  "src/client/theme/organization-theme.ts",
  "src/client/theme/inject.ts",
  "src/client/theme/theme-contract.css",
  "src/client/theme/themes/clean.css",
  "src/client/theme/themes/electrox.css",
  "src/client/theme/dsh-bridge.css",
  "src/client/theme/chrome.css",
]);
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    const path = url.pathname.slice(1);
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "POST" && path === "identity") {
      const selected = url.searchParams.get("id");
      if (!Object.hasOwn(identities, selected)) { response.writeHead(400).end(); return; }
      identity = selected;
      delayMs = Math.max(0, Math.min(3_000, Number(url.searchParams.get("delay")) || 0));
      response.writeHead(204).end();
    } else if (request.method === "POST" && path === "reset") {
      host.dispose();
      identity = "none";
      queryCount = 0;
      host = makeHost();
      response.writeHead(204).end();
    } else if (request.method === "GET" && path === "snapshot") {
      const theme = await host.snapshot();
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ theme, queryCount }));
    } else if (request.method === "GET" && path === "stats") {
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ queryCount }));
    } else if (request.method === "GET" && path === "") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        .end(await readFile(new URL("theme-lab.html", import.meta.url)));
    } else if (request.method === "GET" && modules.has(path)) {
      const file = new URL(path, root);
      const source = path.endsWith(".css")
        ? `export default ${JSON.stringify(readCss(fileURLToPath(file)))}`
        : ts.transpileModule(await readFile(file, "utf8"), {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        }).outputText;
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" }).end(source);
    } else response.writeHead(404).end();
  } catch (error) {
    console.error(error);
    response.writeHead(500).end("Theme lab error");
  }
});
server.listen(0, "127.0.0.1", () => {
  console.log(`Theme lab: http://127.0.0.1:${server.address().port}/`);
  console.log("Synthetic Keys only; the TokensAPI organization endpoint is mocked. Ctrl+C to stop.");
});
server.on("close", () => host.dispose());
