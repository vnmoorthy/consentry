import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { decryptJson, encryptJson, importAesKey, type LedgerEntry, type PersistedState, type Store } from '@consentry/core';

/**
 * SQLite-backed store. The vault, chat transcript and any stored API key are encrypted at rest with AES-256-GCM;
 * the master key lives in .consentry/master.key (chmod 600) and never touches the database.
 */
export class SqliteStore implements Store {
  private db: DatabaseSync;
  private keyPromise: Promise<CryptoKey>;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    const keyPath = join(dir, 'master.key');
    if (!existsSync(keyPath)) {
      writeFileSync(keyPath, randomBytes(32));
      chmodSync(keyPath, 0o600);
    }
    this.keyPromise = importAesKey(new Uint8Array(readFileSync(keyPath)));
    this.db = new DatabaseSync(join(dir, 'consentry.db'));
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger (seq INTEGER PRIMARY KEY, ts INTEGER NOT NULL, kind TEXT NOT NULL, hash TEXT NOT NULL, json TEXT NOT NULL);
    `);
  }

  async load(): Promise<PersistedState | null> {
    const row = this.db.prepare('SELECT value FROM kv WHERE key = ?').get('state') as { value: string } | undefined;
    if (!row) return null;
    const stored = JSON.parse(row.value);
    const key = await this.keyPromise;
    const secret = stored.secret
      ? await decryptJson<{ vault: PersistedState['vault']; apiKey?: string; chat?: PersistedState['chat'] }>(key, stored.secret)
      : { vault: [], chat: [] };
    const { secret: _s, ...rest } = stored;
    return { ...rest, vault: secret.vault, chat: secret.chat ?? [], settings: { ...rest.settings, apiKey: secret.apiKey } };
  }

  async save(state: PersistedState): Promise<void> {
    const key = await this.keyPromise;
    // The chat transcript can contain anything the user typed, so it is encrypted alongside the vault.
    const { vault, settings, chat, ...rest } = state;
    const { apiKey, ...publicSettings } = settings;
    const secret = await encryptJson(key, { vault, apiKey, chat });
    this.db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('state', JSON.stringify({ ...rest, settings: publicSettings, secret }));
  }

  async loadLedger(): Promise<LedgerEntry[]> {
    return (this.db.prepare('SELECT json FROM ledger ORDER BY seq').all() as { json: string }[]).map((r) => JSON.parse(r.json));
  }

  async appendLedger(e: LedgerEntry): Promise<void> {
    this.db.prepare('INSERT OR REPLACE INTO ledger (seq, ts, kind, hash, json) VALUES (?, ?, ?, ?, ?)').run(e.seq, e.ts, e.kind, e.hash, JSON.stringify(e));
  }

  async replaceLedger(entries: LedgerEntry[]): Promise<void> {
    this.db.exec('BEGIN');
    try {
      this.db.exec('DELETE FROM ledger');
      const stmt = this.db.prepare('INSERT INTO ledger (seq, ts, kind, hash, json) VALUES (?, ?, ?, ?, ?)');
      for (const e of entries) stmt.run(e.seq, e.ts, e.kind, e.hash, JSON.stringify(e));
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
}
