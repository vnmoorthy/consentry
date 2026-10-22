import type {
  CategoryId, ConsentDecision, ConsentRequest, EgressResult, FieldDecision, Finding, IngressResult, PolicyRule, Purpose,
  Recipient, ToolCall, ToolDef, TransformId, VaultItem, Verdict,
} from './types';
import { detect, TOKEN_RE } from './detect';
import { evaluate, makeGrant } from './policy';
import { applyTransform, defaultTransform } from './transforms';
import { scanPayload } from './injection';
import { CATEGORIES } from './taxonomy';
import { Ledger } from './ledger';
import { canonicalJson, clone, maskValue, sha256Hex, uid } from './util';

export const WITHHELD = '[withheld by Consentry]';

export interface FirewallDeps {
  vault(): VaultItem[];
  rules(): PolicyRule[];
  recipients(): Recipient[];
  ledger: Ledger;
  askConsent(req: ConsentRequest): Promise<ConsentDecision>;
  addRule(rule: PolicyRule): void;
  ruleHit(ruleId: string): void;
  isTainted(runId?: string): boolean;
  allowlist(): string[];
  onLedger?(entry: import('./types').LedgerEntry): void;
}

interface Planned {
  finding: Finding;
  item?: VaultItem;
  effect: 'allow' | 'deny' | 'ask' | 'minimize';
  transform?: TransformId;
  rule?: PolicyRule;
  reason: string;
  viaConsent?: boolean;
}

function displayBefore(f: Finding, item?: VaultItem): string {
  const sens = item?.sensitivity ?? CATEGORIES[f.category].sensitivity;
  const raw = f.resolved;
  return sens >= 5 ? maskValue(raw, f.category) : raw;
}

function setAtPath(root: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.match(/[^.[\]]+|\[\d+\]/g) ?? [];
  let node: any = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i].startsWith('[') ? Number(parts[i].slice(1, -1)) : parts[i];
    node = node?.[p];
  }
  const last = parts[parts.length - 1];
  if (node && last) node[last.startsWith('[') ? Number(last.slice(1, -1)) : last] = value;
}

function getAtPath(root: unknown, path: string): unknown {
  const parts = path.match(/[^.[\]]+|\[\d+\]/g) ?? [];
  let node: any = root;
  for (const p of parts) node = node?.[p.startsWith('[') ? Number(p.slice(1, -1)) : p];
  return node;
}

/** Inspect an outbound tool call, ask for consent where needed, and return the args that may actually leave. */
export async function inspectEgress(call: ToolCall, tool: ToolDef, recipient: Recipient, deps: FirewallDeps): Promise<EgressResult> {
  const vault = deps.vault();
  const findings = detect(call.args, vault);
  const byId = new Map(vault.map((v) => [v.id, v]));
  const tainted = deps.isTainted(call.runId);

  // Default-deny egress: unverified destinations never get a request at all.
  const unverified = recipient.tier === 'unknown' && !deps.allowlist().includes(recipient.domain);

  const planned: Planned[] = findings.map((finding) => {
    const item = finding.itemId ? byId.get(finding.itemId) : undefined;
    const d = evaluate(deps.rules(), { category: finding.category, recipient, purpose: call.purpose });
    const p: Planned = { finding, item, effect: d.effect, transform: d.transform, rule: d.rule, reason: d.reason };
    const sensitivity = item?.sensitivity ?? CATEGORIES[finding.category].sensitivity;
    if (tainted && sensitivity >= 4 && p.effect !== 'deny' && recipient.tier !== 'llm') {
      p.effect = 'deny';
      p.reason = 'Locked: this run is tainted by a suspected prompt injection';
      p.rule = undefined;
    }
    if (unverified) {
      p.effect = 'deny';
      p.reason = 'Unverified destination — default deny';
    }
    return p;
  });
  for (const p of planned) if (p.rule) deps.ruleHit(p.rule.id);

  // One consent prompt per call, covering every field that needs it.
  const asks = planned.filter((p) => p.effect === 'ask');
  if (asks.length && !unverified) {
    const req: ConsentRequest = {
      id: uid('c_'),
      callId: call.id,
      runId: call.runId,
      tool: tool.name,
      toolTitle: tool.title,
      recipientId: recipient.id,
      recipientName: recipient.name,
      tier: recipient.tier,
      purpose: call.purpose,
      agentName: call.agentName,
      createdAt: Date.now(),
      expiresAt: Date.now() + 180_000,
      items: asks.map((p) => {
        const t = p.transform ?? defaultTransform(p.finding.category, recipient.tier);
        return {
          findingId: p.finding.id,
          category: p.finding.category,
          itemLabel: p.item?.label ?? CATEGORIES[p.finding.category].label,
          preview: displayBefore(p.finding, p.item),
          minimizedPreview: t !== 'redact' ? applyTransform(t, p.finding, p.item, recipient).display : undefined,
          ruleTitle: p.rule?.title,
        };
      }),
    };
    const decision = await deps.askConsent(req);
    for (const p of asks) {
      p.viaConsent = true;
      if (decision === 'allow_once' || decision === 'allow_always') {
        p.effect = 'allow';
        p.reason = decision === 'allow_always' ? 'You allowed this for 30 days' : 'You allowed this once';
      } else if (decision === 'minimize') {
        const t = p.transform ?? defaultTransform(p.finding.category, recipient.tier);
        p.effect = t === 'redact' ? 'deny' : 'minimize';
        p.transform = t;
        p.reason = 'You chose to share a minimized version';
      } else {
        p.effect = 'deny';
        p.reason = 'You declined';
      }
    }
    if (decision === 'allow_always') {
      const seen = new Set<string>();
      for (const p of asks) {
        const key = p.finding.category;
        if (seen.has(key)) continue;
        seen.add(key);
        deps.addRule(makeGrant({ category: p.finding.category, recipient, purpose: call.purpose }, 30 * 86400e3));
      }
    }
  }

  // Apply decisions: rewrite strings from the end so offsets stay valid.
  const sanitized = clone(call.args);
  const decisions: FieldDecision[] = [];
  const byPath = new Map<string, Planned[]>();
  for (const p of planned) {
    const list = byPath.get(p.finding.path) ?? [];
    list.push(p);
    byPath.set(p.finding.path, list);
  }

  for (const [path, list] of byPath) {
    const numericPair = list.find((p) => p.finding.numeric);
    if (numericPair) {
      const m = /^(.*?)\.?\{(\w+),(\w+)\}$/.exec(path);
      if (m) {
        const objPath = m[1];
        const obj = (objPath ? getAtPath(sanitized, objPath) : sanitized) as Record<string, unknown>;
        const out = outputFor(numericPair, recipient);
        if (numericPair.effect === 'deny') {
          delete obj[m[2]];
          delete obj[m[3]];
        } else if (numericPair.effect === 'minimize') {
          const [a, b] = out.value.split(',').map(Number);
          obj[m[2]] = a;
          obj[m[3]] = b;
        }
        decisions.push(toDecision(numericPair, recipient, out.display));
      }
      continue;
    }
    const original = getAtPath(sanitized, path);
    if (typeof original !== 'string') continue;
    let s = original;
    for (const p of [...list].sort((a, b) => (b.finding.start ?? 0) - (a.finding.start ?? 0))) {
      const out = outputFor(p, recipient);
      s = s.slice(0, p.finding.start) + out.value + s.slice(p.finding.end);
      decisions.push(toDecision(p, recipient, out.display));
    }
    // Tokens for items that don't exist resolve to nothing.
    s = s.replace(TOKEN_RE, '');
    setAtPath(sanitized, path, s);
  }

  // A call whose required inputs were withheld can't run.
  let blockedReason: string | undefined;
  if (unverified) {
    blockedReason = `${recipient.domain} is not a verified destination — Consentry blocks unverified egress by default`;
  } else {
    for (const key of tool.requiredArgs ?? []) {
      const v = sanitized[key];
      if (v == null || (typeof v === 'string' && (v.trim() === '' || v.trim() === WITHHELD))) {
        const why = planned.find((p) => p.finding.path === key && p.effect === 'deny');
        blockedReason = `Required field "${key}" was withheld${why ? `: ${why.reason}` : ''}`;
        break;
      }
    }
  }

  const verdict: Verdict = blockedReason
    ? 'blocked'
    : !planned.length
      ? 'clean'
      : planned.some((p) => p.viaConsent && p.effect !== 'deny')
        ? 'consented'
        : planned.some((p) => p.effect === 'deny' || p.effect === 'minimize')
          ? 'minimized'
          : 'allowed';

  const payloadDigest = await sha256Hex(canonicalJson(blockedReason ? {} : sanitized));
  const entry = await deps.ledger.append({
    kind: 'egress',
    summary: `${tool.title} → ${recipient.name}: ${verdict}${blockedReason ? ` (${blockedReason})` : ''}`,
    runId: call.runId,
    tool: tool.name,
    recipientId: recipient.id,
    purpose: call.purpose,
    verdict,
    categories: [...new Set(planned.map((p) => p.finding.category))] as CategoryId[],
    fields: decisions.map((d) => ({ path: d.path, category: d.category, item: d.itemLabel, action: d.action, after: d.action === 'shared' ? maskValue(planned.find((p) => p.finding.id === d.findingId)!.finding.resolved, d.category) : d.after, ruleId: d.ruleId })),
    ruleIds: [...new Set(planned.map((p) => p.rule?.id).filter(Boolean) as string[])],
    payloadDigest,
  });
  deps.onLedger?.(entry);

  return { verdict, sanitizedArgs: blockedReason ? {} : sanitized, findings, decisions, blockedReason, ledgerSeq: entry.seq };
}

function outputFor(p: Planned, recipient: Recipient): { value: string; display: string } {
  if (p.effect === 'allow') return { value: p.finding.resolved, display: p.finding.resolved };
  if (p.effect === 'minimize') return applyTransform(p.transform ?? defaultTransform(p.finding.category, recipient.tier), p.finding, p.item, recipient);
  return { value: WITHHELD, display: 'withheld' };
}

function toDecision(p: Planned, recipient: Recipient, display: string): FieldDecision {
  const action = p.effect === 'allow' ? 'shared' : p.effect === 'minimize' ? (p.transform === 'token' ? 'tokenized' : 'minimized') : 'withheld';
  return {
    findingId: p.finding.id,
    path: p.finding.path,
    category: p.finding.category,
    itemLabel: p.item?.label ?? CATEGORIES[p.finding.category].label,
    effect: p.effect,
    action,
    before: displayBefore(p.finding, p.item),
    after: action === 'shared' ? (recipient.tier === 'llm' ? display : displayBefore(p.finding, p.item)) : display,
    ruleId: p.rule?.id,
    ruleTitle: p.reason,
    transform: p.effect === 'minimize' ? p.transform : undefined,
    viaConsent: p.viaConsent,
  };
}

/** Sanitize text before it reaches the LLM provider (the model is a recipient too). Never prompts. */
export function inspectLLMText(text: string, llm: Recipient, deps: Pick<FirewallDeps, 'vault' | 'rules'>): { sanitized: string; decisions: FieldDecision[] } {
  const vault = deps.vault();
  const findings = detect(text, vault).filter((f) => f.detector !== 'token' && f.detector !== 'lexicon');
  const byId = new Map(vault.map((v) => [v.id, v]));
  const decisions: FieldDecision[] = [];
  let s = text;
  for (const f of [...findings].sort((a, b) => (b.start ?? 0) - (a.start ?? 0))) {
    const item = f.itemId ? byId.get(f.itemId) : undefined;
    const d = evaluate(deps.rules(), { category: f.category, recipient: llm, purpose: 'reasoning' });
    let out: { value: string; display: string };
    let effect = d.effect;
    if (effect === 'allow') out = { value: f.matched, display: f.matched };
    else if (effect === 'deny' || effect === 'ask') {
      effect = 'deny';
      out = { value: `[${CATEGORIES[f.category].label} withheld]`, display: 'withheld' };
    } else out = applyTransform(d.transform ?? 'token', f, item, llm);
    s = s.slice(0, f.start) + out.value + s.slice(f.end);
    decisions.push({ findingId: f.id, path: 'prompt', category: f.category, itemLabel: item?.label ?? CATEGORIES[f.category].label, effect, action: effect === 'allow' ? 'shared' : effect === 'deny' ? 'withheld' : 'tokenized', before: displayBefore(f, item), after: out.display, ruleId: d.rule?.id, ruleTitle: d.reason, transform: d.transform });
  }
  return { sanitized: s, decisions };
}

/** Inspect a tool response before the agent sees it. */
export async function inspectIngress(data: unknown, tool: ToolDef, recipient: Recipient, runId: string | undefined, deps: FirewallDeps): Promise<IngressResult> {
  const known = deps.recipients().map((r) => r.domain).filter((d) => d !== '*');
  const scan = scanPayload(data, known);
  // Legit tool output never contains vault tokens. If it does, someone is trying to get the agent to echo them back.
  let smuggled = 0;
  const neutralize = (node: unknown): unknown => {
    if (typeof node === 'string') return node.replace(TOKEN_RE, () => (smuggled++, '[token removed]'));
    if (Array.isArray(node)) return node.map(neutralize);
    if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, neutralize(v)]));
    return node;
  };
  const sanitized = neutralize(scan.sanitized);
  const clean = scan.threats.length === 0 && smuggled === 0;
  let ledgerSeq: number | undefined;
  if (!clean) {
    const t = scan.threats[0];
    const entry = await deps.ledger.append({
      kind: 'ingress',
      summary: `${tool.title} ← ${recipient.name}: quarantined ${t ? `${t.kind} (score ${t.score})` : 'smuggled vault tokens'}`,
      runId,
      tool: tool.name,
      recipientId: recipient.id,
      verdict: 'quarantined',
      payloadDigest: await sha256Hex(canonicalJson(data)),
    });
    deps.onLedger?.(entry);
    ledgerSeq = entry.seq;
  }
  return { clean, score: scan.score, threats: scan.threats, sanitized, removed: scan.removed + smuggled, ledgerSeq };
}

export type { Purpose };
