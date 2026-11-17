import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = "dist";
const base = "/grid-tactics-pwa/";
const indexPath = join(root, "index.html");
if (!existsSync(indexPath)) throw new Error("dist/index.html is missing.");
const html = readFileSync(indexPath, "utf8");

if (!html.includes(base) || !html.includes(base + "assets/")) {
  throw new Error("The built HTML does not reference the repository Pages base path.");
}

const manifestMatch = html.match(/<link[^>]+rel="manifest"[^>]+href="([^"]+)"/i) ??
  html.match(/<link[^>]+href="([^"]+)"[^>]+rel="manifest"/i);
if (!manifestMatch) throw new Error("The PWA manifest link is missing from index.html.");

const manifestHref = manifestMatch[1];
const manifestRelativePath = manifestHref.startsWith(base)
  ? manifestHref.slice(base.length)
  : manifestHref.replace(/^\/+/, "");
const manifestPath = join(root, manifestRelativePath);
if (!existsSync(manifestPath)) {
  throw new Error("The PWA manifest was not emitted at " + manifestPath);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (manifest.start_url !== "./" || manifest.scope !== "./") {
  throw new Error("The manifest must use relative start_url and scope for project Pages.");
}
if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) {
  throw new Error("The manifest must declare the PWA icon set.");
}
for (const icon of manifest.icons) {
  if (icon.src.startsWith("/")) {
    throw new Error("PWA icon paths must be relative to the manifest.");
  }
  const iconPath = join(root, icon.src.replace(/^\.?\//, ""));
  if (!existsSync(iconPath)) throw new Error("PWA icon is missing: " + icon.src);
}

if (!existsSync(join(root, "sw.js"))) {
  throw new Error("The service worker was not emitted.");
}
if (!readdirSync(root).some((name) => name.startsWith("workbox-") && name.endsWith(".js"))) {
  throw new Error("The Workbox runtime was not emitted.");
}

console.log("GitHub Pages PWA artifact verified: " + base);
