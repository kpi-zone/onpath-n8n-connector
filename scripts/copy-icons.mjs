// Copies SVG icons from src to dist after tsc build
import { mkdirSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const src = join(import.meta.dirname, "..", "nodes");
const dst = join(import.meta.dirname, "..", "dist", "nodes");

function copyIcons(dir) {
  for (const entry of (await import("node:fs/promises")).readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      copyIcons(full);
    } else if (entry.name.endsWith(".svg") || entry.name.endsWith(".png")) {
      const rel = full.replace(src, dst);
      mkdirSync(rel.replace(/\/[^/]+$/, ""), { recursive: true });
      cpSync(full, rel);
      console.log(`Copied ${entry.name}`);
    }
  }
}

copyIcons(src);
