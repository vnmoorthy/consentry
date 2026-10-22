// Small isomorphic helpers (Node 20+ and modern browsers both expose WebCrypto as globalThis.crypto).

export function uid(prefix = ''): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Deterministic JSON: object keys sorted, so hashes are stable across runtimes. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).filter((k) => (value as any)[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson((value as any)[k])).join(',') + '}';
}

/** FNV-1a 32-bit — fast, synchronous, deterministic. Used for stable aliases, not security. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function digitsOnly(s: string): string {
  return s.replace(/\D+/g, '');
}

export function luhnValid(num: string): boolean {
  const digits = digitsOnly(num);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function ageFromDob(dob: string, now = Date.now()): number {
  const d = new Date(dob + 'T00:00:00Z');
  const n = new Date(now);
  let age = n.getUTCFullYear() - d.getUTCFullYear();
  const m = n.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && n.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Mask a value for display / audit. Keeps just enough to be recognisable to its owner. */
export function maskValue(value: string, category: string): string {
  const v = value.trim();
  if (!v) return v;
  if (category === 'financial.card') return '•••• ' + digitsOnly(v).slice(-4);
  if (category === 'identity.gov_id') return '•••-••-' + digitsOnly(v).slice(-4);
  if (category === 'contact.email') {
    const [u, d] = v.split('@');
    return (u?.[0] ?? '') + '•••@' + (d ?? '');
  }
  if (category === 'contact.phone') return '•••-•••-' + digitsOnly(v).slice(-4);
  if (category === 'vehicle.vin') return v.slice(0, 3) + '••••••••' + v.slice(-4);
  if (category === 'identity.dob') return '••/••/' + v.slice(0, 4);
  if (category === 'identity.name') return v.split(/\s+/).map((p) => p[0] + '•'.repeat(Math.max(1, p.length - 1))).join(' ');
  if (category === 'location.precise') {
    if (/^-?\d/.test(v)) return v.replace(/(\.\d)\d+/g, '$1••');
    return '•••• ' + v.split(',').slice(1).join(',').trim();
  }
  if (category.startsWith('health') || category === 'secret.credential') return v[0] + '•'.repeat(Math.min(10, Math.max(3, v.length - 1)));
  if (v.length <= 4) return '••••';
  return v.slice(0, 2) + '•'.repeat(Math.min(8, v.length - 2));
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
