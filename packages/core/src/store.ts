import { getDb } from "./db";
import { rebuildCache } from "./projections";

let initialized = false;

/**
 * Initializes the store once per process: ensures the schema exists and
 * reconciles the SQLite projection cache against the canonical JSONL ledger
 * (source of truth). Safe to call repeatedly; only the first call does work.
 */
export function initStore(): void {
  if (initialized) return;
  getDb();
  rebuildCache();
  initialized = true;
}

/** Forces a cache rebuild from the ledger (e.g. after importing a fixture). */
export function resyncCache(): void {
  rebuildCache();
  initialized = true;
}
