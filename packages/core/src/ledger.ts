import type { LedgerEntry, LedgerVerification } from './types';
import { canonicalJson, sha256Hex } from './util';

export const GENESIS = '0'.repeat(64);

type Draft = Omit<LedgerEntry, 'seq' | 'ts' | 'prevHash' | 'hash'> & { ts?: number };

export async function hashEntry(e: Omit<LedgerEntry, 'hash'>): Promise<string> {
  return sha256Hex(e.prevHash + '|' + canonicalJson({ ...e, prevHash: undefined }));
}

/**
 * Append-only, hash-chained audit log. Each entry commits to the previous one, so editing or
 * deleting any past entry breaks every hash after it. Entries store masked values and a digest of
 * the outbound payload — never the raw personal data itself.
 */
export class Ledger {
  entries: LedgerEntry[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  constructor(entries: LedgerEntry[] = []) {
    this.entries = entries;
  }

  get head(): string {
    return this.entries.length ? this.entries[this.entries.length - 1].hash : GENESIS;
  }

  /** Appends are serialized so concurrent tool calls can't fork the chain. */
  append(draft: Draft): Promise<LedgerEntry> {
    const p = this.queue.then(async () => {
      const prev = this.entries[this.entries.length - 1];
      const base: Omit<LedgerEntry, 'hash'> = {
        ...draft,
        seq: prev ? prev.seq + 1 : 1,
        ts: draft.ts ?? Date.now(),
        prevHash: prev ? prev.hash : GENESIS,
      };
      const entry: LedgerEntry = { ...base, hash: await hashEntry(base) };
      this.entries.push(entry);
      return entry;
    });
    this.queue = p.catch(() => undefined);
    return p;
  }

  async verify(): Promise<LedgerVerification> {
    let prev = GENESIS;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      const { hash, ...rest } = e;
      if (e.prevHash !== prev) return { ok: false, checked: i, brokenAt: e.seq, expected: prev, found: e.prevHash, head: this.head };
      const expected = await hashEntry(rest);
      if (expected !== hash) return { ok: false, checked: i, brokenAt: e.seq, expected, found: hash, head: this.head };
      prev = hash;
    }
    return { ok: true, checked: this.entries.length, head: this.head };
  }

  /** Demo helper: silently rewrite history the way an attacker (or a sloppy vendor) would. */
  tamper(): LedgerEntry | undefined {
    const candidates = this.entries.filter((e) => e.kind === 'egress' && e.verdict !== 'blocked');
    const target = candidates[Math.floor(candidates.length / 2)] ?? this.entries[Math.floor(this.entries.length / 2)];
    if (!target) return undefined;
    target.summary = target.summary.replace(/^(\S+)/, '$1 (edited)') + ' — nothing was shared';
    target.verdict = 'clean';
    target.fields = [];
    return target;
  }

  /** Rebuild hashes from the first broken entry on (used by "repair" after a tamper demo). */
  async rehash(): Promise<void> {
    let prev = GENESIS;
    for (const e of this.entries) {
      e.prevHash = prev;
      const { hash: _h, ...rest } = e;
      e.hash = await hashEntry(rest);
      prev = e.hash;
    }
  }
}
