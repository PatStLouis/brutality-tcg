import path from "node:path";
import fs from "node:fs";

/** Repo root = nearest ancestor containing a workspace package.json. */
function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const pkg = path.join(dir, "package.json");
    if (fs.existsSync(pkg)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pkg, "utf8"));
        if (parsed.workspaces) return dir;
      } catch {
        // keep walking
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export const REPO_ROOT = findRepoRoot();

export function dataDir(): string {
  const dir = path.join(REPO_ROOT, "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function databasePath(): string {
  const configured = process.env.DATABASE_PATH;
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(REPO_ROOT, configured);
  }
  return path.join(dataDir(), "brutality.db");
}

export function baseUrl(): string {
  return process.env.BASE_URL ?? "http://localhost:3000";
}
