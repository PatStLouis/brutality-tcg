import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./env";
import { eventSeqOf, type LedgerEvent } from "./ledgerTypes";

/**
 * Append-only JSON Lines ledger. This file is the canonical source of truth:
 * one complete JSON event object per line. Appending is a single write of one
 * or more lines, which keeps the file valid even if the process dies between
 * events. SQLite holds only rebuildable projections and private working state.
 */

let headId: string | null | undefined = undefined;
let lastSeq: number | null = null;

export function ledgerPath(): string {
  const configured = process.env.LEDGER_PATH;
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(dataDir(), configured);
  }
  return path.join(dataDir(), "ledger.jsonl");
}

function ensureInit(): void {
  if (headId !== undefined && lastSeq !== null) return;
  const p = ledgerPath();
  if (!fs.existsSync(p)) {
    headId = null;
    lastSeq = 0;
    return;
  }
  const text = fs.readFileSync(p, "utf8");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    headId = null;
    lastSeq = 0;
    return;
  }
  const last = JSON.parse(lines[lines.length - 1]) as LedgerEvent;
  headId = last["@id"];
  lastSeq = eventSeqOf(last);
}

/**
 * `@id` of the last event, or `null` when the ledger is empty (Genesis has
 * not been written yet).
 */
export function getHeadId(): string | null {
  ensureInit();
  return headId === undefined ? null : headId;
}

export function getLastSeq(): number {
  ensureInit();
  return lastSeq!;
}

/** Appends already-built, hash-chained events as JSONL lines (single write). */
export function appendRaw(events: LedgerEvent[]): void {
  if (events.length === 0) return;
  ensureInit();
  const p = ledgerPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const payload = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  fs.appendFileSync(p, payload);
  headId = events[events.length - 1]["@id"];
  lastSeq = eventSeqOf(events[events.length - 1]);
}

export function readAllEvents(): LedgerEvent[] {
  const p = ledgerPath();
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, "utf8");
  return text
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as LedgerEvent);
}

/** Overwrites the ledger file (used by fixture import). */
export function writeAllEvents(events: LedgerEvent[]): void {
  const p = ledgerPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const payload = events.length ? events.map((e) => JSON.stringify(e)).join("\n") + "\n" : "";
  fs.writeFileSync(p, payload);
  resetCache();
}

/** Clears the in-memory head cache; call after replacing the ledger file. */
export function resetCache(): void {
  headId = undefined;
  lastSeq = null;
}
