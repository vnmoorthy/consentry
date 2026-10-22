import {
  ConsentryRuntime, REDTEAM_CATALOG, type CategoryId, type CompiledPolicy, type ConsentDecision, type LedgerEntry, type LedgerVerification,
  type DataRequest, type Footprint, type PolicyRule, type Purpose, type RedTeamReport, type RuntimeEvent, type Settings, type Snapshot, type Tier, type VaultItem,
} from '@consentry/core';
import { BrowserStore } from './localStore';

export type SimResult = ReturnType<ConsentryRuntime['simulate']>;
export type HealthMap = Record<string, { id: string; ok: boolean; ms: number; status: number }>;
export type RedTeamInfo = (typeof REDTEAM_CATALOG)[number];

export interface ConsentryClient {
  mode: 'server' | 'local';
  subscribe(fn: (e: RuntimeEvent) => void, onStatus?: (s: 'live' | 'reconnecting') => void): () => void;
  snapshot(): Promise<Snapshot>;
  chat(message: string): Promise<{ runId: string }>;
  clearChat(): Promise<void>;
  resolveConsent(id: string, decision: ConsentDecision): Promise<void>;
  revealVault(id: string): Promise<string | null>;
  upsertVault(item: Partial<VaultItem> & { label: string; category: CategoryId; value: string }): Promise<void>;
  deleteVault(id: string): Promise<void>;
  upsertPolicy(rule: PolicyRule): Promise<void>;
  togglePolicy(id: string, enabled: boolean): Promise<void>;
  deletePolicy(id: string): Promise<void>;
  compilePolicy(text: string): Promise<CompiledPolicy>;
  simulate(q: { itemId?: string; recipientId: string; purpose: Purpose }): Promise<SimResult>;
  ledger(limit?: number): Promise<LedgerEntry[]>;
  verifyLedger(): Promise<LedgerVerification>;
  tamperLedger(): Promise<void>;
  repairLedger(): Promise<LedgerVerification>;
  exportLedger(): Promise<unknown>;
  toggleTool(name: string, enabled: boolean): Promise<void>;
  setTier(id: string, tier: Tier): Promise<void>;
  health(): Promise<HealthMap>;
  redteamCatalog(): Promise<RedTeamInfo[]>;
  runRedTeam(id: string): Promise<RedTeamReport>;
  updateSettings(patch: Partial<Settings> & { apiKey?: string }): Promise<void>;
  reset(): Promise<void>;
  footprint(): Promise<Footprint>;
  recentEvents(): Promise<RuntimeEvent[]>;
  draftDeletion(recipientId: string): Promise<DataRequest>;
  sendRequest(id: string): Promise<DataRequest>;
}

async function j<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error ?? `HTTP ${res.status}`);
  return data as T;
}

const post = (url: string, body?: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

export class ServerClient implements ConsentryClient {
  mode = 'server' as const;
  constructor(private base = '') {}
  subscribe(fn: (e: RuntimeEvent) => void, onStatus?: (s: 'live' | 'reconnecting') => void) {
    let es: EventSource | null = null;
    let closed = false;
    const open = () => {
      es = new EventSource(`${this.base}/api/events`);
      es.addEventListener('hello', () => onStatus?.('live'));
      es.addEventListener('event', (m) => fn(JSON.parse((m as MessageEvent).data)));
      es.onerror = () => {
        onStatus?.('reconnecting');
        es?.close();
        if (!closed) setTimeout(open, 1500);
      };
    };
    open();
    return () => {
      closed = true;
      es?.close();
    };
  }
  snapshot = () => fetch(`${this.base}/api/state`).then((r) => j<Snapshot>(r));
  chat = (message: string) => post(`${this.base}/api/chat`, { message }).then((r) => j<{ runId: string }>(r));
  clearChat = () => post(`${this.base}/api/chat/clear`).then(() => undefined);
  resolveConsent = (id: string, decision: ConsentDecision) => post(`${this.base}/api/consent/${id}`, { decision }).then(() => undefined);
  revealVault = (id: string) => fetch(`${this.base}/api/vault/${id}/reveal`).then((r) => j<{ value: string | null }>(r)).then((d) => d.value);
  upsertVault = (item: any) => post(`${this.base}/api/vault`, item).then((r) => j(r)).then(() => undefined);
  deleteVault = (id: string) => fetch(`${this.base}/api/vault/${id}`, { method: 'DELETE' }).then(() => undefined);
  upsertPolicy = (rule: PolicyRule) => post(`${this.base}/api/policies`, rule).then((r) => j(r)).then(() => undefined);
  togglePolicy = (id: string, enabled: boolean) => post(`${this.base}/api/policies/${id}/toggle`, { enabled }).then((r) => j(r)).then(() => undefined);
  deletePolicy = (id: string) => fetch(`${this.base}/api/policies/${id}`, { method: 'DELETE' }).then((r) => j(r)).then(() => undefined);
  compilePolicy = (text: string) => post(`${this.base}/api/policies/compile`, { text }).then((r) => j<CompiledPolicy>(r));
  simulate = (q: any) => post(`${this.base}/api/policies/simulate`, q).then((r) => j<SimResult>(r));
  ledger = (limit = 300) => fetch(`${this.base}/api/ledger?limit=${limit}`).then((r) => j<LedgerEntry[]>(r));
  verifyLedger = () => post(`${this.base}/api/ledger/verify`).then((r) => j<LedgerVerification>(r));
  tamperLedger = () => post(`${this.base}/api/ledger/tamper`).then(() => undefined);
  repairLedger = () => post(`${this.base}/api/ledger/repair`).then((r) => j<LedgerVerification>(r));
  exportLedger = () => fetch(`${this.base}/api/ledger/export`).then((r) => j(r));
  toggleTool = (name: string, enabled: boolean) => post(`${this.base}/api/tools/${name}/toggle`, { enabled }).then(() => undefined);
  setTier = (id: string, tier: Tier) => post(`${this.base}/api/recipients/${id}/tier`, { tier }).then(() => undefined);
  health = () => fetch(`${this.base}/api/health/apis`).then((r) => j<HealthMap>(r));
  redteamCatalog = () => fetch(`${this.base}/api/redteam`).then((r) => j<RedTeamInfo[]>(r));
  runRedTeam = (id: string) => post(`${this.base}/api/redteam/${id}`).then((r) => j<RedTeamReport>(r));
  updateSettings = (patch: any) => fetch(`${this.base}/api/settings`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) }).then((r) => j(r)).then(() => undefined);
  reset = () => post(`${this.base}/api/reset`).then(() => undefined);
  footprint = () => fetch(`${this.base}/api/footprint`).then((r) => j<Footprint>(r));
  recentEvents = () => fetch(`${this.base}/api/recent-events`).then((r) => j<RuntimeEvent[]>(r));
  draftDeletion = (recipientId: string) => post(`${this.base}/api/requests`, { recipientId }).then((r) => j<DataRequest>(r));
  sendRequest = (id: string) => post(`${this.base}/api/requests/${id}/send`).then((r) => j<DataRequest>(r));
}

/** Local-first: the full Consentry runtime runs inside this browser tab. Nothing leaves except consented tool calls. */
export class LocalClient implements ConsentryClient {
  mode = 'local' as const;
  private constructor(private rt: ConsentryRuntime) {}
  static async create() {
    const rt = await ConsentryRuntime.create({ store: new BrowserStore(), mode: 'local', browser: true });
    return new LocalClient(rt);
  }
  subscribe(fn: (e: RuntimeEvent) => void, onStatus?: (s: 'live' | 'reconnecting') => void) {
    onStatus?.('live');
    return this.rt.on(fn);
  }
  snapshot = async () => this.rt.snapshot();
  chat = async (message: string) => {
    const { runId, done } = this.rt.startRun(message);
    done.catch((e) => console.error(e));
    return { runId };
  };
  clearChat = async () => this.rt.clearChat();
  resolveConsent = async (id: string, d: ConsentDecision) => void this.rt.resolveConsent(id, d);
  revealVault = async (id: string) => this.rt.revealVault(id) ?? null;
  upsertVault = async (item: any) => void this.rt.upsertVault(item);
  deleteVault = async (id: string) => this.rt.deleteVault(id);
  upsertPolicy = async (rule: PolicyRule) => void this.rt.upsertPolicy(rule);
  togglePolicy = async (id: string, enabled: boolean) => this.rt.togglePolicy(id, enabled);
  deletePolicy = async (id: string) => this.rt.deletePolicy(id);
  compilePolicy = async (text: string) => this.rt.compilePolicy(text);
  simulate = async (q: any) => this.rt.simulate(q);
  ledger = async (limit = 300) => this.rt.listLedger(limit);
  verifyLedger = () => this.rt.verifyLedger();
  tamperLedger = async () => void (await this.rt.tamperLedger());
  repairLedger = () => this.rt.repairLedger();
  exportLedger = async () => this.rt.exportLedger();
  toggleTool = async (name: string, enabled: boolean) => this.rt.toggleTool(name, enabled);
  setTier = async (id: string, tier: Tier) => this.rt.setRecipientTier(id, tier);
  health = () => this.rt.health() as Promise<HealthMap>;
  redteamCatalog = async () => REDTEAM_CATALOG;
  runRedTeam = (id: string) => this.rt.runRedTeam(id);
  updateSettings = async (patch: any) => void this.rt.updateSettings(patch);
  reset = () => this.rt.reset();
  footprint = async () => this.rt.footprint();
  recentEvents = async () => this.rt.recentEvents.slice(-150);
  draftDeletion = (recipientId: string) => this.rt.draftDeletion(recipientId);
  sendRequest = (id: string) => this.rt.sendRequest(id);
}

let connecting: Promise<ConsentryClient> | null = null;

/** Singleton: React StrictMode mounts twice in dev and we must not open two event streams. */
export function connect(): Promise<ConsentryClient> {
  connecting ??= doConnect();
  return connecting;
}

async function doConnect(): Promise<ConsentryClient> {
  const forceLocal = import.meta.env.VITE_FORCE_LOCAL === '1' || new URLSearchParams(location.search).has('local');
  if (!forceLocal) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 1500);
      const r = await fetch('/api/health', { signal: ac.signal });
      clearTimeout(t);
      if (r.ok && (await r.json()).mode === 'server') return new ServerClient();
    } catch {
      /* no gateway running — fall through to local-first */
    }
  }
  return LocalClient.create();
}
