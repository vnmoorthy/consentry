import type { CategoryId, Finding, Recipient, Tier, TransformId, VaultItem } from './types';
import { registerGenerated } from './detect';
import { ageFromDob, digitsOnly, fnv1a, luhnValid } from './util';

export const TRANSFORM_LABELS: Record<TransformId, string> = {
  'coarse-location': 'Approximate (~10 km)',
  neighborhood: 'Neighborhood (~1 km)',
  intersection: 'Nearest intersection',
  alias: 'Relay alias',
  'virtual-card': 'Single-use virtual card',
  'age-range': 'Age range',
  'first-name': 'First name only',
  initials: 'Initials',
  'dietary-need': 'Dietary need (no diagnosis)',
  'generic-name': 'Generic drug name only',
  redact: 'Withheld',
  token: 'Vault token',
};

const isCoords = (s: string) => /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(s);
const round = (n: number, d: number) => Number(n.toFixed(d));

export interface TransformOutput {
  /** What actually gets sent. */
  value: string;
  /** What the UI shows in the diff. */
  display: string;
}

function roundCoords(s: string, decimals: number): string {
  const [a, b] = s.split(',').map((x) => parseFloat(x));
  return `${round(a, decimals)},${round(b, decimals)}`;
}

function virtualCard(seed: string): string {
  // Deterministic, Luhn-valid, clearly-virtual number (4000 05xx … is a test BIN).
  const h = fnv1a(seed).toString().padStart(10, '0');
  const body = ('400005' + h).slice(0, 15);
  for (let c = 0; c <= 9; c++) {
    const n = body + c;
    if (luhnValid(n)) return n.replace(/(\d{4})(?=\d)/g, '$1 ');
  }
  return body + '0';
}

export function applyTransform(t: TransformId, finding: Finding, item: VaultItem | undefined, recipient: Recipient): TransformOutput {
  const raw = finding.resolved;
  const meta = item?.meta ?? {};
  switch (t) {
    case 'token': {
      const v = item ? `{{vault:${item.key}}}` : `[${finding.category} withheld]`;
      return { value: v, display: v };
    }
    case 'redact':
      return { value: '[withheld by Consentry]', display: 'withheld' };
    case 'coarse-location': {
      if (isCoords(raw)) {
        const v = roundCoords(raw, 1);
        return { value: v, display: `${v} (≈10 km)` };
      }
      const v = meta.city ? `${meta.city}, ${meta.state ?? ''}`.replace(/,\s*$/, '') : '[approximate area]';
      return { value: v, display: v };
    }
    case 'neighborhood': {
      if (isCoords(raw)) {
        const v = roundCoords(raw, 2);
        return { value: v, display: `${v} (≈1 km)` };
      }
      const v = [meta.neighborhood, meta.city, meta.state].filter(Boolean).join(', ') || '[neighborhood]';
      return { value: v, display: v };
    }
    case 'intersection': {
      if (isCoords(raw)) {
        const v = roundCoords(raw, 3);
        return { value: v, display: `${v} (≈100 m)` };
      }
      const v = meta.intersection ? `${meta.intersection}, ${meta.city ?? ''} ${meta.state ?? ''} ${meta.zip ?? ''}`.replace(/\s+/g, ' ').trim() : '[nearest intersection]';
      return { value: v, display: v };
    }
    case 'alias': {
      const h = fnv1a(recipient.id + '|' + raw);
      if (finding.category === 'contact.email') {
        const first = (item?.meta?.first ?? raw.split('@')[0].split(/[._]/)[0] ?? 'me').toLowerCase();
        const v = `${first}.${h.toString(36).slice(0, 5)}@relay.consentry.dev`;
        registerGenerated(v);
        return { value: v, display: `${v} (relay)` };
      }
      if (finding.category === 'contact.phone') {
        const realLast4 = digitsOnly(raw).slice(-4);
        let n = 200 + (h % 700);
        if (n.toString().padStart(4, '0') === realLast4) n++;
        const v = `+1 (628) 555-${n.toString().padStart(4, '0')}`;
        registerGenerated(v);
        return { value: v, display: `${v} (relay)` };
      }
      const v = `alias-${h.toString(36).slice(0, 6)}`;
      registerGenerated(v);
      return { value: v, display: v };
    }
    case 'virtual-card': {
      const v = virtualCard(recipient.id + '|' + digitsOnly(raw) + '|' + new Date().toISOString().slice(0, 10));
      registerGenerated(v);
      return { value: v, display: `•••• ${digitsOnly(v).slice(-4)} (single-use, ${recipient.name}-only)` };
    }
    case 'age-range': {
      const age = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? ageFromDob(raw) : NaN;
      if (Number.isNaN(age)) return { value: 'adult', display: 'adult' };
      const lo = Math.floor(age / 5) * 5;
      const v = `${lo}-${lo + 4}`;
      return { value: v, display: `age ${v}` };
    }
    case 'first-name': {
      const v = meta.first ?? raw.split(/\s+/)[0];
      return { value: v, display: v };
    }
    case 'initials': {
      const v = raw.split(/\s+/).map((p) => p[0]?.toUpperCase() + '.').join(' ');
      return { value: v, display: v };
    }
    case 'generic-name': {
      // "Albuterol HFA inhaler (ProAir)" → "albuterol": enough to look up recalls, no brand, dose or form.
      const v = (item?.keywords?.[0] ?? raw.split(/[\s(]/)[0]).toLowerCase();
      return { value: v, display: v };
    }
    case 'dietary-need': {
      const v = meta.dietary ?? 'Dietary restriction — details on request';
      return { value: v, display: v };
    }
  }
}

/** When the user says "share a minimized version", pick the most sensible transform for the data type. */
export function defaultTransform(category: CategoryId, tier: Tier): TransformId {
  switch (category) {
    case 'location.precise':
      return tier === 'partner' ? 'neighborhood' : 'coarse-location';
    case 'contact.email':
    case 'contact.phone':
      return 'alias';
    case 'identity.dob':
      return 'age-range';
    case 'identity.name':
      return 'first-name';
    case 'financial.card':
      return 'virtual-card';
    case 'health.allergy':
      return 'dietary-need';
    case 'health.medication':
      return 'generic-name';
    default:
      return 'redact';
  }
}

export function previewTransform(t: TransformId | undefined, finding: Finding, item: VaultItem | undefined, recipient: Recipient): string | undefined {
  if (!t) return undefined;
  return applyTransform(t, finding, item, recipient).display;
}
