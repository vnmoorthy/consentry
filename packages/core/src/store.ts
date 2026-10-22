import type { LedgerEntry, PersistedState, Store } from './types';
import { clone } from './util';

/** In-memory store for tests and ephemeral sessions. */
export class MemoryStore implements Store {
  private state: PersistedState | null = null;
  private entries: LedgerEntry[] = [];
  async load() {
    return this.state ? clone(this.state) : null;
  }
  async save(s: PersistedState) {
    this.state = clone(s);
  }
  async loadLedger() {
    return clone(this.entries);
  }
  async appendLedger(e: LedgerEntry) {
    this.entries.push(clone(e));
  }
  async replaceLedger(es: LedgerEntry[]) {
    this.entries = clone(es);
  }
}

/** AES-256-GCM helpers on WebCrypto — the same code encrypts the vault in Node and in the browser. */
export async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const ct = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return toB64(out);
}

export async function decryptJson<T>(key: CryptoKey, b64: string): Promise<T> {
  const buf = fromB64(b64);
  const iv = buf.slice(0, 12);
  const pt = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, buf.slice(12));
  return JSON.parse(new TextDecoder().decode(pt));
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
