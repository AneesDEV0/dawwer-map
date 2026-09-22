import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const sourceFiles = ["index.html", "styles.css", "data.js", "navigation.js", "app.js"];
const files = {};

for (const filename of sourceFiles) {
  files[`/${filename}`] = await readFile(resolve(root, filename), "utf8");
}

const worker = `const files = ${JSON.stringify(files)};
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = decodeURIComponent(url.pathname);
    if (path === "/") path = "/index.html";
    let body = files[path];
    let status = 200;

    if (body === undefined && request.headers.get("accept")?.includes("text/html")) {
      body = files["/index.html"];
    }
    if (body === undefined) {
      return new Response("Not found", { status: 404 });
    }

    const extension = path.slice(path.lastIndexOf("."));
    const headers = new Headers({
      "content-type": contentTypes[extension] || "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin"
    });
    if (extension !== ".html") headers.set("cache-control", "public, max-age=3600");
    return new Response(body, { status, headers });
  }
};
`;

await mkdir(resolve(root, "dist", "server"), { recursive: true });
await writeFile(resolve(root, "dist", "server", "index.js"), worker, "utf8");
console.log(`Built ${sourceFiles.length} static files into dist/server/index.js`);
