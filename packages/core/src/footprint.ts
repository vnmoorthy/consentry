import type { CategoryId, DataRequest, Footprint, FootprintGroup, FootprintRow, LedgerEntry, Receipt, Recipient, VaultItem } from './types';
import { CATEGORIES } from './taxonomy';

export const FOOTPRINT_GROUPS: FootprintGroup[] = ['Identity', 'Contact', 'Location', 'Health', 'Money', 'Vehicle'];

export function footprintGroup(c: CategoryId): FootprintGroup {
  const g = CATEGORIES[c]?.group;
  if (g === 'Financial') return 'Money';
  if (g === 'Inferred') return 'Health';
  if (g === 'Secrets') return 'Identity';
  return (g as FootprintGroup) ?? 'Identity';
}

const RANK = { exact: 3, approx: 2, protected: 1 } as const;

/** Who knows what about you, computed from the ledger alone (never from raw data). */
export function computeFootprint(entries: LedgerEntry[], recipients: Recipient[], receipts: Receipt[], requests: DataRequest[]): Footprint {
  const rows = new Map<string, FootprintRow>();
  let threats = 0;
  let blockedCalls = 0;
  const rowFor = (id: string): FootprintRow => {
    let r = rows.get(id);
    if (!r) {
      const rec = recipients.find((x) => x.id === id);
      r = { recipientId: id, name: rec?.name ?? id, emoji: rec?.emoji, tier: rec?.tier ?? 'unknown', simulated: rec?.simulated, calls: 0, exact: 0, approx: 0, protected: 0, cells: {} };
      rows.set(id, r);
    }
    return r;
  };
  for (const e of entries) {
    if (e.kind === 'ingress') threats++;
    if ((e.kind !== 'egress' && e.kind !== 'llm') || !e.recipientId || e.recipientId === 'self') continue;
    const r = rowFor(e.recipientId);
    r.calls++;
    r.lastAt = e.ts;
    if (e.verdict === 'blocked') blockedCalls++;
    for (const f of e.fields ?? []) {
      const blocked = e.verdict === 'blocked';
      const state = blocked || f.action === 'withheld' ? 'protected' : f.action === 'shared' ? 'exact' : 'approx';
      const g = footprintGroup(f.category);
      const cell = (r.cells[g] ??= { state, items: [] });
      if (RANK[state] > RANK[cell.state]) cell.state = state;
      const label = f.item ?? CATEGORIES[f.category]?.label ?? f.category;
      const action = blocked ? 'withheld' : f.action;
      const existing = cell.items.find((i) => i.label === label && i.action === action);
      if (existing) existing.count++;
      else cell.items.push({ label, form: blocked ? 'blocked' : f.after, action, count: 1 });
      if (state === 'exact') r.exact++;
      else if (state === 'approx') r.approx++;
      else r.protected++;
    }
  }
  for (const req of requests) {
    const r = rows.get(req.recipientId);
    if (r && (!r.request || req.status === 'confirmed' || (req.status === 'sent' && r.request === 'drafted'))) r.request = req.status;
  }
  const order = (t: string) => ['llm', 'partner', 'unknown', 'public-sector', 'open-data'].indexOf(t);
  const list = [...rows.values()].sort((a, b) => order(a.tier) - order(b.tier) || b.exact - a.exact || b.calls - a.calls);
  return {
    groups: FOOTPRINT_GROUPS,
    rows: list,
    totals: {
      recipients: list.filter((r) => r.exact + r.approx > 0).length,
      exact: list.reduce((s, r) => s + r.exact, 0),
      approx: list.reduce((s, r) => s + r.approx, 0),
      protected: list.reduce((s, r) => s + r.protected, 0),
      threats,
      blockedCalls,
    },
    timeline: receipts.slice(-14).map((rc) => ({
      runId: rc.runId,
      prompt: rc.prompt,
      at: rc.startedAt,
      exact: rc.shared.filter((s) => s.form === 'exact').length,
      approx: rc.shared.filter((s) => s.form !== 'exact').length,
      withheld: rc.withheld.length,
      threats: rc.threats.length,
    })),
  };
}

/** Draft a CCPA/GDPR deletion request citing exactly what the ledger says this recipient received. */
export function draftDeletionLetter(recipient: Recipient, entries: LedgerEntry[], vault: VaultItem[], head: string): Pick<DataRequest, 'to' | 'subject' | 'letter' | 'evidence'> {
  const mine = entries.filter((e) => (e.kind === 'egress' || e.kind === 'llm') && e.recipientId === recipient.id && e.verdict !== 'blocked');
  const items = new Map<string, { form: string; count: number; last: number }>();
  for (const e of mine) {
    for (const f of e.fields ?? []) {
      if (f.action === 'withheld') continue;
      const label = f.item ?? CATEGORIES[f.category]?.label ?? f.category;
      const form = f.action === 'shared' ? 'exact value' : f.after.replace(/ \([^()]*\)$/, '');
      const key = `${label}|${form}`;
      const cur = items.get(key) ?? { form, count: 0, last: 0 };
      cur.count++;
      cur.last = Math.max(cur.last, e.ts);
      items.set(key, cur);
    }
  }
  const name = vault.find((v) => v.key === 'full_name')?.value ?? 'the account holder';
  const domain = recipient.domain.replace(/^api\./, '');
  const date = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const lines = [...items.entries()].map(([k, v]) => `  • ${k.split('|')[0]}: ${v.form}${v.count > 1 ? ` (${v.count} times)` : ''}, last shared ${date(v.last)}`);
  const hasAliases = [...items.keys()].some((k) => /relay|single-use|virtual/i.test(k));
  const letter = [
    `Hello ${recipient.name} privacy team,`,
    '',
    `Under the California Consumer Privacy Act (Cal. Civ. Code § 1798.105) and, where it applies, Article 17 of the GDPR, I request that you delete all personal information you hold about me, and that you direct any service providers or third parties you shared it with to do the same.`,
    '',
    `My consent ledger shows that my personal agent shared the following with ${recipient.name}:`,
    ...(lines.length ? lines : ['  • (no personal data, only non-identifying queries)']),
    '',
    hasAliases ? 'The relay aliases and single-use payment card above were issued only to you and are being revoked today.' : '',
    `Evidence: Consentry ledger entries ${mine.map((e) => `#${e.seq}`).join(', ') || '—'}, hash-chained under head ${head.slice(0, 16)}….`,
    '',
    'Please confirm deletion within 45 days, as the CCPA requires (or within one month under the GDPR).',
    '',
    'Thank you,',
    name,
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n');
  return { to: `privacy@${domain}`, subject: `Request to delete my personal information`, letter, evidence: mine.map((e) => ({ seq: e.seq, hash: e.hash })) };
}
