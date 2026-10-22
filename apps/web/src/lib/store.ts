import { create } from 'zustand';
import type { CategoryId, ConsentRequest, EgressResult, FieldDecision, IngressResult, Purpose, Receipt, RuntimeEvent, Snapshot } from '@consentry/core';
import type { ConsentryClient } from './client';

export interface CallView {
  callId: string;
  tool: string;
  toolTitle: string;
  recipientId: string;
  purpose: Purpose;
  args: Record<string, unknown>;
  egress?: EgressResult;
  ingress?: Omit<IngressResult, 'sanitized'>;
  result?: { ok: boolean; summary: string; ms: number };
  ts: number;
}

export interface RunView {
  runId: string;
  prompt: string;
  agent: Receipt['agent'];
  steps: { text: string; ts: number }[];
  calls: CallView[];
  llm?: { original: string; sanitized: string; decisions: FieldDecision[] };
  message?: string;
  receipt?: Receipt;
  status: 'running' | 'done';
  startedAt: number;
}

export interface ChatItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  runId?: string;
  ts: number;
}

export type FeedItem =
  | { id: string; kind: 'egress'; ts: number; runId?: string; tool: string; recipientId: string; purpose: Purpose; result: EgressResult }
  | { id: string; kind: 'ingress'; ts: number; runId?: string; tool: string; recipientId: string; result: Omit<IngressResult, 'sanitized'> }
  | { id: string; kind: 'llm'; ts: number; runId: string; sanitized: string; original: string; decisions: FieldDecision[] }
  | { id: string; kind: 'consent'; ts: number; request: ConsentRequest; decision?: string };

export interface Packet {
  id: string;
  category: CategoryId | 'query';
  recipientId: string;
  outcome: 'shared' | 'minimized' | 'withheld' | 'tokenized' | 'query' | 'threat' | 'blocked';
  label: string;
  ts: number;
  delay: number;
}

interface Toast {
  id: string;
  tone: 'ok' | 'warn' | 'bad' | 'info';
  title: string;
  body?: string;
}

interface AppState {
  client: ConsentryClient | null;
  status: 'connecting' | 'live' | 'reconnecting';
  snap: Snapshot | null;
  chat: ChatItem[];
  runs: Record<string, RunView>;
  activeRunId: string | null;
  feed: FeedItem[];
  packets: Packet[];
  consents: ConsentRequest[];
  toasts: Toast[];
  receiptOpen: string | null;
  ledgerPulse: number;
  init(client: ConsentryClient): Promise<void>;
  refresh(): Promise<void>;
  send(text: string): Promise<void>;
  answerConsent(id: string, decision: import('@consentry/core').ConsentDecision): Promise<void>;
  toast(t: Omit<Toast, 'id'>): void;
  dismissToast(id: string): void;
  openReceipt(runId: string | null): void;
  replay(runId: string): void;
  clearChat(): Promise<void>;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
/** True while re-applying past events after a reload: rebuild feed and traces, but no chat duplicates, packets or toasts. */
let replaying = false;
let seq = 0;
const nid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const useApp = create<AppState>((set, get) => {
  const patchRun = (runId: string | undefined, fn: (r: RunView) => RunView) => {
    if (!runId) return;
    const r = get().runs[runId];
    if (r) set({ runs: { ...get().runs, [runId]: fn(r) } });
  };
  const patchCall = (runId: string | undefined, callId: string, fn: (c: CallView) => CallView) =>
    patchRun(runId, (r) => ({ ...r, calls: r.calls.map((c) => (c.callId === callId ? fn(c) : c)) }));

  const pushFeed = (item: FeedItem) => set({ feed: [item, ...get().feed].slice(0, 120) });
  const pushPackets = (ps: Omit<Packet, 'id' | 'ts'>[]) => {
    if (replaying) return;
    const now = Date.now();
    const fresh = get().packets.filter((p) => now - p.ts < 6000);
    set({ packets: [...fresh, ...ps.map((p) => ({ ...p, id: nid('pk'), ts: now }))].slice(-60) });
  };

  const handle = (e: RuntimeEvent) => {
    switch (e.type) {
      case 'run.start':
        set({
          runs: { ...get().runs, [e.runId]: { runId: e.runId, prompt: e.prompt, agent: e.agent, steps: [], calls: [], status: 'running', startedAt: e.ts } },
          activeRunId: e.runId,
          chat: replaying || get().chat.some((c) => c.runId === e.runId && c.role === 'user') ? get().chat : [...get().chat, { id: nid('m'), role: 'user', text: e.prompt, runId: e.runId, ts: e.ts }],
        });
        break;
      case 'agent.step':
        patchRun(e.runId, (r) => ({ ...r, steps: [...r.steps, { text: e.text, ts: e.ts }] }));
        break;
      case 'llm.egress':
        patchRun(e.runId, (r) => ({ ...r, llm: { original: e.original, sanitized: e.sanitized, decisions: e.decisions } }));
        pushFeed({ id: nid('f'), kind: 'llm', ts: e.ts, runId: e.runId, sanitized: e.sanitized, original: e.original, decisions: e.decisions });
        pushPackets(e.decisions.map((d, i) => ({ category: d.category, recipientId: 'claude', outcome: d.action, label: d.itemLabel ?? '', delay: i * 0.12 })));
        break;
      case 'tool.call':
        patchRun(e.runId, (r) => ({ ...r, calls: [...r.calls, { callId: e.callId, tool: e.tool, toolTitle: e.toolTitle, recipientId: e.recipientId, purpose: e.purpose, args: e.args, ts: e.ts }] }));
        break;
      case 'firewall.egress': {
        patchCall(e.runId, e.callId, (c) => ({ ...c, egress: e.result }));
        pushFeed({ id: nid('f'), kind: 'egress', ts: e.ts, runId: e.runId, tool: e.tool, recipientId: e.recipientId, purpose: e.purpose, result: e.result });
        if (e.recipientId === 'self') break;
        const blocked = e.result.verdict === 'blocked';
        const ps: Omit<Packet, 'id' | 'ts'>[] = e.result.decisions.map((d, i) => ({ category: d.category, recipientId: e.recipientId, outcome: blocked ? 'blocked' : d.action, label: d.itemLabel ?? '', delay: i * 0.14 }));
        if (!ps.length) ps.push({ category: 'query', recipientId: e.recipientId, outcome: blocked ? 'blocked' : 'query', label: e.tool, delay: 0 });
        pushPackets(ps);
        break;
      }
      case 'firewall.ingress':
        patchCall(e.runId, e.callId, (c) => ({ ...c, ingress: e.result }));
        pushFeed({ id: nid('f'), kind: 'ingress', ts: e.ts, runId: e.runId, tool: e.tool, recipientId: e.recipientId, result: e.result });
        pushPackets([{ category: 'query', recipientId: e.recipientId, outcome: 'threat', label: 'injection', delay: 0.2 }]);
        if (!replaying) get().toast({ tone: 'bad', title: 'Prompt injection quarantined', body: `${e.result.threats[0]?.signals[0] ?? 'Suspicious content'} — from ${e.recipientId}` });
        break;
      case 'tool.result':
        patchCall(e.runId, e.callId, (c) => ({ ...c, result: { ok: e.ok, summary: e.summary, ms: e.ms } }));
        break;
      case 'consent.request':
        pushFeed({ id: 'consent-' + e.request.id, kind: 'consent', ts: e.ts, request: e.request });
        if (!replaying && !e.request.agentName?.startsWith('Red-team')) set({ consents: [...get().consents, e.request] });
        break;
      case 'consent.resolved':
        set({
          consents: get().consents.filter((c) => c.id !== e.id),
          feed: get().feed.map((f) => (f.kind === 'consent' && f.request.id === e.id ? { ...f, decision: e.decision } : f)),
        });
        break;
      case 'agent.message':
        patchRun(e.runId, (r) => ({ ...r, message: e.text }));
        if (!replaying) set({ chat: [...get().chat, { id: nid('m'), role: 'assistant', text: e.text, runId: e.runId, ts: e.ts }] });
        break;
      case 'run.end':
        patchRun(e.runId, (r) => ({ ...r, receipt: e.receipt, status: 'done' }));
        scheduleRefresh();
        break;
      case 'ledger.append':
        set({ ledgerPulse: get().ledgerPulse + 1 });
        scheduleRefresh(600);
        break;
      case 'state.changed':
        scheduleRefresh(100);
        break;
    }
  };

  const scheduleRefresh = (ms = 300) => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void get().refresh(), ms);
  };

  return {
    client: null,
    status: 'connecting',
    snap: null,
    chat: [],
    runs: {},
    activeRunId: null,
    feed: [],
    packets: [],
    consents: [],
    toasts: [],
    receiptOpen: null,
    ledgerPulse: 0,
    async init(client) {
      if (get().client === client) return;
      set({ client });
      client.subscribe(handle, (s) => set({ status: s }));
      const snap = await client.snapshot();
      set({
        snap,
        status: 'live',
        consents: snap.pendingConsents,
        chat: snap.chat.map((c) => ({ id: nid('m'), role: c.role, text: c.text, runId: c.runId, ts: c.ts })),
        runs: Object.fromEntries(snap.receipts.map((r) => [r.runId, { runId: r.runId, prompt: r.prompt, agent: r.agent, steps: [], calls: [], receipt: r, status: 'done' as const, startedAt: r.startedAt }])),
      });
      // Rebuild the feed and run traces from recent history so a reload mid-demo loses nothing.
      try {
        const past = await client.recentEvents();
        replaying = true;
        for (const e of past) {
          if (e.type === 'run.start' && get().runs[e.runId]) {
            const r = get().runs[e.runId];
            set({ runs: { ...get().runs, [e.runId]: { ...r, steps: [], calls: [] } } });
            continue;
          }
          handle(e);
        }
      } catch {
        /* older gateway without history */
      } finally {
        replaying = false;
      }
      // Runs that were still open in history but have no receipt are not running any more.
      set({ runs: Object.fromEntries(Object.entries(get().runs).map(([k, r]) => [k, r.status === 'running' && !snap.pendingConsents.some((c) => c.runId === k) ? { ...r, status: 'done' as const } : r])) });
    },
    async refresh() {
      const c = get().client;
      if (!c) return;
      try {
        const snap = await c.snapshot();
        set({ snap });
      } catch {
        /* transient */
      }
    },
    async send(text) {
      const c = get().client;
      if (!c || !text.trim()) return;
      try {
        await c.chat(text.trim());
      } catch (err: any) {
        get().toast({ tone: 'bad', title: 'Could not reach the agent', body: err?.message });
      }
    },
    async answerConsent(id, decision) {
      set({ consents: get().consents.filter((c) => c.id !== id) });
      await get().client?.resolveConsent(id, decision);
    },
    toast(t) {
      const id = nid('t');
      set({ toasts: [...get().toasts, { ...t, id }].slice(-4) });
      setTimeout(() => get().dismissToast(id), 4800);
    },
    dismissToast(id) {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    },
    openReceipt(runId) {
      set({ receiptOpen: runId });
    },
    replay(runId) {
      // Re-animate a past run on the flow map from its recorded decisions.
      const run = get().runs[runId];
      if (!run) return;
      const ps: Omit<Packet, 'id' | 'ts'>[] = [];
      let n = 0;
      if (run.calls.some((c) => c.egress)) {
        for (const c of run.calls) {
          if (!c.egress || c.recipientId === 'self') continue;
          const blocked = c.egress.verdict === 'blocked';
          if (!c.egress.decisions.length) ps.push({ category: 'query', recipientId: c.recipientId, outcome: blocked ? 'blocked' : 'query', label: c.tool, delay: n++ * 0.35 });
          for (const d of c.egress.decisions) ps.push({ category: d.category, recipientId: c.recipientId, outcome: blocked ? 'blocked' : d.action, label: d.itemLabel ?? '', delay: n++ * 0.35 });
          if (c.ingress && !c.ingress.clean) ps.push({ category: 'query', recipientId: c.recipientId, outcome: 'threat', label: 'injection', delay: n++ * 0.35 });
        }
      } else if (run.receipt) {
        for (const s of run.receipt.shared) ps.push({ category: s.category, recipientId: s.recipientId, outcome: s.form === 'exact' ? 'shared' : 'minimized', label: s.label, delay: n++ * 0.35 });
        for (const w of run.receipt.withheld) ps.push({ category: w.category, recipientId: w.recipientId, outcome: 'withheld', label: w.label, delay: n++ * 0.35 });
      }
      const now = Date.now();
      // Packets live as long as the replay needs.
      set({ packets: [...get().packets.filter((p) => now - p.ts < 6000), ...ps.map((p) => ({ ...p, id: nid('rp'), ts: now + p.delay * 1000 - 0 }))].slice(-80) });
    },
    async clearChat() {
      await get().client?.clearChat();
      set({ chat: [], activeRunId: null });
    },
  };
});

export const recipientName = (snap: Snapshot | null, id: string) => snap?.recipients.find((r) => r.id === id)?.name ?? (id === 'unknown' ? 'Unknown destination' : id);
