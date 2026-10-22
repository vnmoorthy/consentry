import { decryptJson, encryptJson, importAesKey, type LedgerEntry, type PersistedState, type Store } from '@consentry/core';

const STATE_KEY = 'consentry:state:v3';
const LEDGER_KEY = 'consentry:ledger:v3';

/** Keep a non-extractable AES key in IndexedDB so the vault is encrypted at rest in the browser too. */
async function getKey(): Promise<CryptoKey | null> {
  try {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('consentry', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('keys');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const existing: CryptoKey | undefined = await new Promise((res) => {
      const tx = db.transaction('keys', 'readonly').objectStore('keys').get('vault');
      tx.onsuccess = () => res(tx.result);
      tx.onerror = () => res(undefined);
    });
    if (existing) return existing;
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const key = await importAesKey(raw);
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('keys', 'readwrite').objectStore('keys').put(key, 'vault');
      tx.onsuccess = () => res();
      tx.onerror = () => rej(tx.error);
    });
    return key;
  } catch {
    return null;
  }
}

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage full or blocked — the session keeps working in memory */
  }
}

export class BrowserStore implements Store {
  private keyP = getKey();
  private ledger: LedgerEntry[] = [];
  private ledgerTimer: ReturnType<typeof setTimeout> | null = null;

  async load(): Promise<PersistedState | null> {
    const raw = safeGet(STATE_KEY);
    if (!raw) return null;
    try {
      const stored = JSON.parse(raw);
      const key = await this.keyP;
      if (stored.secret && key) {
        const secret = await decryptJson<any>(key, stored.secret);
        const { secret: _s, ...rest } = stored;
        return { ...rest, vault: secret.vault, chat: secret.chat ?? [], settings: { ...rest.settings, apiKey: secret.apiKey } };
      }
      return stored.vault ? stored : null;
    } catch {
      return null;
    }
  }

  async save(state: PersistedState): Promise<void> {
    const key = await this.keyP;
    const { vault, chat, settings, ...rest } = state;
    const { apiKey, ...pub } = settings;
    if (key) safeSet(STATE_KEY, JSON.stringify({ ...rest, settings: pub, secret: await encryptJson(key, { vault, chat, apiKey }) }));
    else safeSet(STATE_KEY, JSON.stringify({ ...rest, settings: pub, vault, chat: [] }));
  }

  async loadLedger(): Promise<LedgerEntry[]> {
    try {
      this.ledger = JSON.parse(safeGet(LEDGER_KEY) ?? '[]');
    } catch {
      this.ledger = [];
    }
    return this.ledger.map((e) => ({ ...e }));
  }

  private flush() {
    if (this.ledgerTimer) clearTimeout(this.ledgerTimer);
    this.ledgerTimer = setTimeout(() => safeSet(LEDGER_KEY, JSON.stringify(this.ledger.slice(-1500))), 200);
  }

  async appendLedger(e: LedgerEntry): Promise<void> {
    this.ledger.push({ ...e });
    this.flush();
  }

  async replaceLedger(entries: LedgerEntry[]): Promise<void> {
    this.ledger = entries.map((e) => ({ ...e }));
    this.flush();
  }
}
