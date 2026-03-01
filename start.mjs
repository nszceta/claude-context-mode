#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);
// Detect runtime environment and set project directory
// Support both Claude Code and opencode
if (process.env.CLAUDE_PROJECT_DIR) {
  // Claude Code environment
  process.env.PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR;
} else if (process.env.OPENCODE_PROJECT_DIR) {
  // opencode environment
  process.env.PROJECT_DIR = process.env.OPENCODE_PROJECT_DIR;
} else if (process.env.PROJECT_ROOT) {
  // Generic project root
  process.env.PROJECT_DIR = process.env.PROJECT_ROOT;
} else {
  // Fallback to current working directory
  process.env.PROJECT_DIR = process.cwd();
}

// Normalize to CLAUDE_PROJECT_DIR for internal compatibility (backward compat)
if (!process.env.CLAUDE_PROJECT_DIR) {
  process.env.CLAUDE_PROJECT_DIR = process.env.PROJECT_DIR;
}
if (!process.env.CLAUDE_PROJECT_DIR) {
  process.env.CLAUDE_PROJECT_DIR = process.cwd();
}

// Self-heal: if a newer version dir exists, update registry so next session uses it
const cacheMatch = __dirname.match(
  /^(.*[\/\\]plugins[\/\\]cache[\/\\][^\/\\]+[\/\\][^\/\\]+[\/\\])([^\/\\]+)$/,
);
if (cacheMatch) {
  try {
    const cacheParent = cacheMatch[1];
    const myVersion = cacheMatch[2];
    const dirs = readdirSync(cacheParent).filter((d) =>
      /^\d+\.\d+\.\d+/.test(d),
    );
    if (dirs.length > 1) {
      dirs.sort((a, b) => {
        const pa = a.split(".").map(Number);
        const pb = b.split(".").map(Number);
        for (let i = 0; i < 3; i++) {
          if ((pa[i] ?? 0) !== (pb[i] ?? 0))
            return (pa[i] ?? 0) - (pb[i] ?? 0);
        }
        return 0;
      });
      const newest = dirs[dirs.length - 1];
      if (newest && newest !== myVersion) {
        const ipPath = resolve(
          homedir(),
          ".claude",
          "plugins",
          "installed_plugins.json",
        );
        const ip = JSON.parse(readFileSync(ipPath, "utf-8"));
        for (const [key, entries] of Object.entries(ip.plugins || {})) {
          if (!key.toLowerCase().includes("context-mode")) continue;
          for (const entry of entries) {
            entry.installPath = resolve(cacheParent, newest);
            entry.version = newest;
            entry.lastUpdated = new Date().toISOString();
          }
        }
        writeFileSync(
          ipPath,
          JSON.stringify(ip, null, 2) + "\n",
          "utf-8",
        );
      }
    }
  } catch {
    /* best effort — don't block server startup */
  }
}

// Ensure native module is available
if (!existsSync(resolve(__dirname, "node_modules", "better-sqlite3"))) {
  try {
    execSync("npm install better-sqlite3 --no-package-lock --no-save --silent", {
      cwd: __dirname,
      stdio: "pipe",
      timeout: 60000,
    });
  } catch { /* best effort */ }
}
// Bundle exists (CI-built) — start instantly
if (existsSync(resolve(__dirname, "server.bundle.mjs"))) {
  await import("./server.bundle.mjs");
} else {
  // Dev or npm install — full build
  if (!existsSync(resolve(__dirname, "node_modules"))) {
    try {
      execSync("npm install --silent", { cwd: __dirname, stdio: "pipe", timeout: 60000 });
    } catch { /* best effort */ }
  }
  if (!existsSync(resolve(__dirname, "build", "server.js"))) {
    try {
      execSync("npx tsc --silent", { cwd: __dirname, stdio: "pipe", timeout: 30000 });
    } catch { /* best effort */ }
  }
  await import("./build/server.js");
}

console.error(`[context-mode] Project directory: ${process.env.PROJECT_DIR}`);
console.error(`[context-mode] Running in ${process.env.CLAUDE_CODE ? 'Claude Code' : process.env.OPENCODE ? 'opencode' : 'standalone'} mode`);
// Bundle exists (CI-built) — start instantly
if (existsSync(resolve(__dirname, "server.bundle.mjs"))) {
  await import("./server.bundle.mjs");
} else {
  // Dev or npm install — full build
  if (!existsSync(resolve(__dirname, "node_modules"))) {
    try {
      execSync("npm install --silent", { cwd: __dirname, stdio: "pipe", timeout: 60000 });
    } catch { /* best effort */ }
  }
  if (!existsSync(resolve(__dirname, "build", "server.js"))) {
    try {
      execSync("npx tsc --silent", { cwd: __dirname, stdio: "pipe", timeout: 30000 });
    } catch { /* best effort */ }
  }
  await import("./build/server.js");
}
