import type { CategoryId, Detector, Finding, VaultItem } from './types';
import { digitsOnly, escapeRegExp, haversineKm, luhnValid, uid } from './util';

/**
 * Values Consentry itself generated (relay aliases, virtual cards). They look like PII
 * to a pattern matcher, but they are safe by construction — so we never re-flag them.
 */
const GENERATED = new Set<string>();
export function registerGenerated(value: string) {
  GENERATED.add(normalize(value));
  const d = digitsOnly(value);
  if (d.length >= 7) GENERATED.add('#' + d);
}
function isGenerated(value: string): boolean {
  return GENERATED.has(normalize(value)) || GENERATED.has('#' + digitsOnly(value));
}
function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export const TOKEN_RE = /\{\{\s*vault:([a-z0-9_]+)\s*\}\}/gi;

const HEALTH_LEXICON = [
  'asthma', 'asthmatic', 'diabetes', 'diabetic', 'insulin', 'depression', 'anxiety', 'hiv', 'aids', 'cancer', 'chemotherapy',
  'pregnant', 'pregnancy', 'abortion', 'epilepsy', 'seizure', 'adhd', 'bipolar', 'schizophrenia', 'hypertension', 'copd',
  'allergy', 'allergic', 'peanut', 'peanuts', 'gluten', 'celiac', 'migraine', 'opioid', 'methadone', 'rehab', 'std',
  'psychiatric', 'inhaler', 'bronchospasm', 'antidepressant', 'ssri', 'albuterol', 'fluticasone', 'sertraline', 'epipen',
  'anaphylaxis', 'wheelchair', 'dialysis', 'hepatitis', 'ozempic', 'semaglutide', 'metformin', 'lisinopril', 'adderall',
];

const SSN_RE = /\b(?!000|666|9\d\d)\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b/g;
const CARD_RE = /\b(?:\d[ -]?){12,18}\d\b/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const SECRET_RE = /\b(?:sk-[A-Za-z0-9_-]{16,}|sk_live_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g;
const COORD_RE = /(-?\d{1,2}\.\d{2,})\s*,\s*(-?\d{1,3}\.\d{2,})/g;

const DETECTOR_RANK: Record<Detector, number> = { token: 5, vault: 4, geo: 3, pattern: 2, lexicon: 1 };

/** Only flag coordinates this close to a vault location as "precise". Rounded (minimized) coordinates fall outside it. */
export const PRECISE_RADIUS_KM = 0.35;

interface Needle {
  item: VaultItem;
  category: CategoryId;
  re?: RegExp;
  digits?: string;
  confidence: number;
}

function buildNeedles(vault: VaultItem[]): Needle[] {
  const needles: Needle[] = [];
  const word = (s: string) => new RegExp('(?<![A-Za-z0-9])' + escapeRegExp(s).replace(/\s+/g, '\\s+') + '(?![A-Za-z0-9])', 'gi');
  for (const item of vault) {
    const v = item.value.trim();
    if (!v) continue;
    switch (item.category) {
      case 'contact.phone':
      case 'identity.gov_id':
      case 'financial.card':
        needles.push({ item, category: item.category, digits: digitsOnly(v), confidence: 0.99 });
        break;
      case 'identity.dob': {
        needles.push({ item, category: item.category, re: word(v), confidence: 0.98 });
        const [y, m, d] = v.split('-');
        if (y && m && d) {
          needles.push({ item, category: item.category, re: new RegExp(`\\b0?${+m}[/.-]0?${+d}[/.-]${y}\\b`, 'g'), confidence: 0.95 });
          const month = new Date(Date.UTC(+y, +m - 1, +d)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
          needles.push({ item, category: item.category, re: new RegExp(`\\b${month}\\s+${+d},?\\s+${y}\\b`, 'gi'), confidence: 0.95 });
        }
        break;
      }
      case 'location.precise': {
        if (/^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(v)) break; // GPS items are handled by geo proximity
        needles.push({ item, category: item.category, re: word(v), confidence: 0.99 });
        if (item.meta?.street) needles.push({ item, category: item.category, re: word(item.meta.street), confidence: 0.95 });
        if (item.meta?.zip) needles.push({ item, category: 'location.coarse', re: new RegExp(`\\b${item.meta.zip}\\b`, 'g'), confidence: 0.6 });
        break;
      }
      case 'identity.name': {
        needles.push({ item, category: item.category, re: word(v), confidence: 0.99 });
        const last = item.meta?.last;
        if (last && last.length >= 4) needles.push({ item, category: item.category, re: word(last), confidence: 0.6 });
        break;
      }
      default:
        needles.push({ item, category: item.category, re: word(v), confidence: 0.99 });
    }
    for (const kw of item.keywords ?? []) {
      needles.push({ item, category: item.category, re: word(kw), confidence: 0.9 });
    }
  }
  return needles;
}

function scanString(path: string, s: string, vault: VaultItem[], needles: Needle[], byKey: Map<string, VaultItem>): Finding[] {
  const out: Finding[] = [];
  const push = (f: Omit<Finding, 'id'>) => out.push({ id: uid('f_'), ...f });

  // 1. Vault tokens the agent used instead of raw values.
  for (const m of s.matchAll(TOKEN_RE)) {
    const item = byKey.get(m[1].toLowerCase());
    if (!item) continue;
    push({ path, category: item.category, itemId: item.id, itemKey: item.key, itemLabel: item.label, matched: m[0], resolved: item.value, detector: 'token', confidence: 1, start: m.index!, end: m.index! + m[0].length });
  }

  // 2. Raw vault values (fingerprint matching).
  for (const n of needles) {
    if (n.re) {
      n.re.lastIndex = 0;
      for (const m of s.matchAll(n.re)) {
        if (isGenerated(m[0])) continue;
        push({ path, category: n.category, itemId: n.item.id, itemKey: n.item.key, itemLabel: n.item.label, matched: m[0], resolved: n.category === 'location.coarse' ? m[0] : n.item.value, detector: 'vault', confidence: n.confidence, start: m.index!, end: m.index! + m[0].length });
      }
    } else if (n.digits) {
      const re = n.category === 'financial.card' ? CARD_RE : n.category === 'identity.gov_id' ? /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g : PHONE_RE;
      re.lastIndex = 0;
      for (const m of s.matchAll(re)) {
        const d = digitsOnly(m[0]);
        const target = n.digits;
        const hit = n.category === 'contact.phone' ? d.slice(-10) === target.slice(-10) : d === target;
        if (hit && !isGenerated(m[0])) push({ path, category: n.category, itemId: n.item.id, itemKey: n.item.key, itemLabel: n.item.label, matched: m[0], resolved: n.item.value, detector: 'vault', confidence: n.confidence, start: m.index!, end: m.index! + m[0].length });
      }
    }
  }

  // 3. Coordinates close to a known place of yours.
  for (const m of s.matchAll(COORD_RE)) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    const near = nearestPreciseItem(vault, lat, lon);
    if (near) push({ path, category: 'location.precise', itemId: near.id, itemKey: near.key, itemLabel: near.label, matched: m[0], resolved: `${lat},${lon}`, detector: 'geo', confidence: 0.97, start: m.index!, end: m.index! + m[0].length });
  }

  // 4. Generic PII patterns — catches data that isn't in the vault (a stranger's SSN, a pasted card).
  const generic: [RegExp, CategoryId, (m: string) => boolean][] = [
    [SSN_RE, 'identity.gov_id', () => true],
    [CARD_RE, 'financial.card', (m) => luhnValid(m)],
    [EMAIL_RE, 'contact.email', (m) => !/@relay\.consentry\.dev$/i.test(m)],
    [PHONE_RE, 'contact.phone', (m) => digitsOnly(m).length >= 10],
    [SECRET_RE, 'secret.credential', () => true],
  ];
  for (const [re, category, ok] of generic) {
    re.lastIndex = 0;
    for (const m of s.matchAll(re)) {
      if (!ok(m[0]) || isGenerated(m[0])) continue;
      push({ path, category, matched: m[0], resolved: m[0], detector: 'pattern', confidence: 0.85, start: m.index!, end: m.index! + m[0].length });
    }
  }

  // 5. Health lexicon — the query itself can reveal something sensitive.
  const lower = s.toLowerCase();
  for (const term of HEALTH_LEXICON) {
    let idx = lower.indexOf(term);
    while (idx !== -1) {
      const before = idx === 0 ? ' ' : lower[idx - 1];
      const after = lower[idx + term.length] ?? ' ';
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) {
        push({ path, category: 'inferred.health', matched: s.slice(idx, idx + term.length), resolved: s.slice(idx, idx + term.length), detector: 'lexicon', confidence: 0.7, start: idx, end: idx + term.length });
      }
      idx = lower.indexOf(term, idx + term.length);
    }
  }
  return dedupe(out);
}

/** Overlapping spans: keep the strongest detector, then the longest match. */
function dedupe(findings: Finding[]): Finding[] {
  const sorted = [...findings].sort((a, b) => DETECTOR_RANK[b.detector] - DETECTOR_RANK[a.detector] || (b.end! - b.start!) - (a.end! - a.start!) || b.confidence - a.confidence);
  const kept: Finding[] = [];
  for (const f of sorted) {
    if (kept.some((k) => k.path === f.path && k.start! < f.end! && f.start! < k.end!)) continue;
    kept.push(f);
  }
  return kept.sort((a, b) => a.path.localeCompare(b.path) || a.start! - b.start!);
}

export function nearestPreciseItem(vault: VaultItem[], lat: number, lon: number): VaultItem | undefined {
  let best: VaultItem | undefined;
  let bestD = Infinity;
  for (const item of vault) {
    if (item.category !== 'location.precise' || item.meta?.lat == null || item.meta?.lon == null) continue;
    const d = haversineKm(lat, lon, item.meta.lat, item.meta.lon);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  // Prefer the GPS item for coordinate matches so the label reads naturally.
  if (best && bestD <= PRECISE_RADIUS_KM) {
    const gps = vault.find((v) => v.category === 'location.precise' && /^-?\d+\.\d+\s*,/.test(v.value) && v.meta?.lat === best!.meta?.lat);
    return gps ?? best;
  }
  return undefined;
}

const LAT_KEYS = ['lat', 'latitude'];
const LON_KEYS = ['lon', 'lng', 'long', 'longitude'];

/** Walk any JSON payload and return every piece of personal data found in it. */
export function detect(payload: unknown, vault: VaultItem[]): Finding[] {
  const needles = buildNeedles(vault);
  const byKey = new Map(vault.map((v) => [v.key.toLowerCase(), v]));
  const findings: Finding[] = [];

  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      findings.push(...scanString(path, node, vault, needles, byKey));
    } else if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
    } else if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const latKey = Object.keys(obj).find((k) => LAT_KEYS.includes(k.toLowerCase()));
      const lonKey = Object.keys(obj).find((k) => LON_KEYS.includes(k.toLowerCase()));
      if (latKey && lonKey) {
        const lat = Number(obj[latKey]);
        const lon = Number(obj[lonKey]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const near = nearestPreciseItem(vault, lat, lon);
          if (near) {
            findings.push({ id: uid('f_'), path: path ? `${path}.{${latKey},${lonKey}}` : `{${latKey},${lonKey}}`, category: 'location.precise', itemId: near.id, itemKey: near.key, itemLabel: near.label, matched: `${lat},${lon}`, resolved: `${lat},${lon}`, detector: 'geo', confidence: 0.97, numeric: true });
          }
        }
      }
      for (const [k, v] of Object.entries(obj)) {
        if (latKey && lonKey && (k === latKey || k === lonKey) && typeof v === 'number') continue;
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  };
  walk(payload, '');
  return findings;
}

export function isHealthTerm(term: string) {
  return HEALTH_LEXICON.includes(term.toLowerCase());
}
