// Copies SVG icons from src to dist after tsc build
import { mkdirSync, cpSync } from "node:fs";
import { join } from "node:path";
import { readdir } from "node:fs/promises";

const src = join(import.meta.dirname, "..", "nodes");
const dst = join(import.meta.dirname, "..", "dist", "nodes");

async function copyIcons(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      await copyIcons(full);
    } else if (entry.name.endsWith(".svg") || entry.name.endsWith(".png")) {
      const rel = full.replace(src, dst);
      mkdirSync(rel.replace(/\/[^/]+$/, ""), { recursive: true });
      cpSync(full, rel);
      console.log(`Copied ${entry.name}`);
    }
  }
}

await copyIcons(src);
