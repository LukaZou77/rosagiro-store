import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function resolvePath(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const requested = normalize(join(root, pathname));
  if (!requested.startsWith(root)) return null;
  if (existsSync(requested) && statSync(requested).isFile()) return requested;
  return join(root, "index.html");
}

createServer((req, res) => {
  const file = resolvePath(req.url || "/");
  if (!file || !existsSync(file)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": types[extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`Bela Viva prototype running at http://127.0.0.1:${port}`);
});
